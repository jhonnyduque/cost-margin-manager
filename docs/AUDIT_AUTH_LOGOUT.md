# Informe Técnico: Resolución de Bucle Infinito en Logout y Estabilización de Autenticación

## 1. Resumen Ejecutivo
Se identificó y resolvió un bucle infinito de redirecciones que ocurría tras el cierre de sesión (logout). La causa raíz era una **condición de carrera de estado (state race condition)** combinada con la falta de guardias de ruta en el componente de carga de datos (`AuthProvider`). El sistema intentaba re-cargar datos de usuario para una sesión que ya estaba siendo destruida, lo que provocaba que el estado de carga (`isLoading`) se activara y desactivara repetidamente, disparando re-evaluaciones de rutas en `App.tsx` que entraban en conflicto con la redirección de Supabase.

## 2. Análisis del Flujo (Paso a Paso)

### El Escenario del Error (Antes del Fix):
1.  **Acción**: El usuario hace clic en "Logout".
2.  **Disparador**: Se llama a `supabase.auth.signOut()`.
3.  **Evento**: Supabase emite el evento `SIGNED_OUT`.
4.  **Reacción**: El `onAuthStateChange` en `AuthProvider` llama a `resetState()`.
5.  **Conflicto**: Simultáneamente, la aplicación comienza a navegar a `/login`.
6.  **Carrera**: 
    - `App.tsx` detecta el cambio de ruta y el estado de `isLoading`.
    - Un `useEffect` de inicialización o una actualización de token en segundo plano podía disparar un `loadUserData` accidental si no detectaba que ya estábamos en `/login`.
    - `loadUserData` ponía `isLoading = true`.
    - `App.tsx` mostraba el spinner global.
    - El logout de Supabase a veces dejaba un "residuo" de sesión por milisegundos que el `init()` leía como "hay sesión", intentando cargar datos inexistentes.
    - Esto bloqueaba la renderización del formulario de `Login` y podía redirigir al usuario erróneamente a `/not-provisioned` si el estado de la empresa no se limpiaba atómicamente.

### El Flujo Corregido (Después del Fix):
1.  **Bloqueo Preventivo**: `AuthProvider` activa un flag `isSigningOut = true` e inmediatamente limpia el estado local antes de llamar a Supabase.
2.  **Inmunidad de Ruta**: Se implementaron guardias en `loadUserData` y `onAuthStateChange` para ignorar eventos automáticos si la ruta es `/login`.
3.  **Prioridad de Entrada**: `App.tsx` ahora renderiza el componente `Login` inmediatamente si la ruta es `/login`, ignorando procesos de fondo, a menos que haya un usuario válido confirmado.

## 3. Problemas Detectados y Soluciones

### P1: Carrera de Carga de Datos (Crítico)
-   **Archivo**: `src/hooks/AuthProvider.tsx`
-   **Problema**: `loadUserData` no comprobaba si el sistema estaba en proceso de cierre de sesión.
-   **Solución**: Introducción de `isSigningOut`.
-   **Código**:
    ```typescript
    if (isSigningOut || isFetching.current) return;
    ```

### P2: Bloqueo de Redirección en Login (Alto)
-   **Archivo**: `src/App.tsx`
-   **Problema**: El loader global bloqueaba la evaluación de la ruta `/login` si había cualquier transición de autenticación.
-   **Solución**: Mover la evaluación de la ruta `/login` al principio de la lógica de ruteo.
-   **Código**:
    ```tsx
    if (location.pathname === '/login') {
        if (user && !isSigningOut) return <Navigate to="..." />;
        return <Login />;
    }
    ```

### P3: Navegación "Huérfana" post-Login (Medio)
-   **Archivo**: `src/pages/Login.tsx`
-   **Problema**: Tras un `signInWithPassword` exitoso, la app no siempre detectaba el cambio de estado rápido para redirigir.
-   - **Solución**: Añadir `navigate('/dashboard')` explícito en el `handleLogin` y un bloque `finally` para limpiar el estado de carga del botón.

## 4. Fragmentos de Código Corregidos

### `AuthProvider.tsx` (Guardia de Logout)
```typescript
// Antes: loadUserData se ejecutaba siempre
// Después:
const loadUserData = useCallback(async (userId: string) => {
    if (isSigningOut || isFetching.current) {
        console.log('[AuthProvider] loadUserData - SKIPPED (SigningOut/Fetching)');
        return;
    }
    // ... resto de la lógica
}, [isSigningOut]);
```

### `App.tsx` (Estructura de Rutas)
```tsx
// Antes: if (isLoading) bloqueaba todo.
// Después:
if (location.pathname === '/login') {
    if (user && !isSigningOut) return <Navigate to="/dashboard" />;
    return <Login />;
}

if (isAuthLoading || isSigningOut) {
    return <Loader />; // Spinner solo si no es Login
}
```

## 5. Recomendaciones de Buenas Prácticas
1.  **Limpieza Atómica**: Siempre limpiar el estado global (`user`, `token`, `config`) antes o simultáneamente a la llamada de logout en el servidor.
2.  **Flags de Transición**: Usar estados como `isSigningOut` para desactivar efectos secundarios (fetching, polling, etc.) durante las transiciones de identidad.
3.  **Prioridad de Rutas Públicas**: Las páginas como `/login` o `/recovery` deben ser evaluadas por el router antes que los estados de carga globales para evitar que errores en el "handshake" de sesión bloqueen el acceso al formulario.
4.  **Logs de Trazabilidad**: Mantener logs de los eventos de autenticación (`onAuthStateChange`) para identificar de dónde proviene un disparo de carga inesperado.
