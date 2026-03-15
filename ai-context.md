# BETO OS — AI Context & Style Rules
**Versión:** 1.0 — 15/03/2026
**Estado:** Authoritative

---

## 1. Fuente de verdad única

El archivo `src/styles/global.css` es la **única fuente de verdad visual** de BETO OS.
Contiene todos los tokens de color, spacing, tipografía, radius y sombras.

**Antes de escribir cualquier estilo, consulta ese archivo.**

---

## 2. Cómo aplicar estilos en componentes y páginas nuevas

### ✅ Correcto — usar clases CSS del sistema
```tsx
// Clases definidas en global.css
<div className="card">
<span className="badge badge-success">
<button className="btn btn-primary">
<table className="table">
<div className="metric-card">
<p className="text-muted">
```

### ✅ Correcto — usar variables CSS via style prop (solo cuando no hay clase)
```tsx
style={{ color: 'var(--color-primary)' }}
style={{ gap: 'var(--space-16)' }}
style={{ borderRadius: 'var(--radius-md)' }}
```

### ❌ Prohibido — clases Tailwind directas sin pasar por token
```tsx
// NUNCA hacer esto en páginas o componentes nuevos
className="text-slate-900"
className="p-4 gap-6"
className="rounded-lg shadow-md"
```

### ❌ Prohibido — valores hardcodeados en style prop
```tsx
// NUNCA hacer esto
style={{ color: '#0F172A' }}
style={{ padding: '16px' }}
style={{ borderRadius: '8px' }}
```

---

## 3. Tokens disponibles (referencia rápida)

### Colores
| Variable | Uso |
|---|---|
| `var(--color-primary)` | Acciones principales, activo |
| `var(--color-neutral-900)` | Texto principal |
| `var(--color-neutral-700)` | Texto secundario, labels |
| `var(--color-neutral-400)` | Texto muted, placeholders |
| `var(--color-neutral-0)` | Superficies blancas, cards |
| `var(--color-neutral-50)` | Canvas de página |
| `var(--color-neutral-100)` | Superficies muted, header tabla |
| `var(--color-neutral-200)` | Bordes, divisores |
| `var(--color-success)` | Estado positivo |
| `var(--color-warning)` | Alerta, precaución |
| `var(--color-danger)` | Destructivo, error |
| `var(--color-info)` | Información contextual |

### Spacing
| Variable | Valor | Uso típico |
|---|---|---|
| `var(--space-4)` | 4px | Micro gaps |
| `var(--space-8)` | 8px | Gaps compactos |
| `var(--space-12)` | 12px | Padding interno pequeño |
| `var(--space-16)` | 16px | Padding estándar |
| `var(--space-24)` | 24px | Padding de cards, gaps de sección |
| `var(--space-32)` | 32px | Padding de contenido |
| `var(--space-48)` | 48px | Separación entre secciones |

### Radius
| Variable | Valor | Uso |
|---|---|---|
| `var(--radius-sm)` | 6px | Badges, chips |
| `var(--radius-md)` | 8px | Botones, inputs, nav items |
| `var(--radius-lg)` | 12px | Cards internas, panels |
| `var(--radius-xl)` | 16px | Cards principales, modales |

### Sombras
| Variable | Uso |
|---|---|
| `var(--shadow-sm)` | Cards estándar |
| `var(--shadow-md)` | Popovers, dropdowns |
| `var(--shadow-lg)` | Modales |

---

## 4. Clases CSS disponibles (no inventar variantes)

### Layout
- `.app-shell` — grid principal sidebar + contenido
- `.main-shell` — columna de contenido
- `.content` — área de contenido, max-width **1280px** (`--container-xl`)
- `.section` — sección con separación vertical
- `.section-head` — encabezado de sección con borde
- `.grid` `.grid-2` `.grid-3` `.grid-4` — grids responsivos (base: 12 columnas conceptuales)
- `.stack` — flex column con gap
- `.row` — flex row con gap

> **Grid system:** BETO OS usa un sistema de 12 columnas conceptuales.
> `.grid-2` = 6+6 · `.grid-3` = 4+4+4 · `.grid-4` = 3+3+3+3.
> Nunca más de 4 columnas en una fila. Nunca más de 4 KPI cards por fila.

### Componentes
- `.card` — card principal (fondo blanco, borde, radius-xl, shadow-sm)
- `.metric-card` — card KPI con radius-lg
- `.inset-card` — card anidada con fondo neutro-50
- `.btn` `.btn-primary` `.btn-secondary` `.btn-danger` `.btn-ghost` `.btn-sm`
- `.badge` `.badge-neutral` `.badge-info` `.badge-success` `.badge-warning` `.badge-danger`
- `.alert` `.alert-info` `.alert-success` `.alert-warning` `.alert-danger`
- `.table` — tabla con header, hover y bordes
- `.input` `.select` `.textarea` — campos de formulario
- `.field` `.field-label` `.field-help` `.field-error` — estructura de campo
- `.modal-overlay` `.modal-card` `.modal-actions`
- `.tabs` `.tab` `.tab.is-active`
- `.pagination` `.pagination-btn` `.pagination-btn.is-current`
- `.breadcrumbs` `.breadcrumb-sep`
- `.empty-state`
- `.page-header`

### Tipografía
- `.text-display` `.text-h1` `.text-h2` `.text-h3` `.text-body` `.text-small`
- `.text-primary` `.text-secondary` `.text-muted`
- `.text-success` `.text-warning` `.text-danger` `.text-info`
- `.font-mono` `.tabular`

### Sidebar / Nav
- `.sidebar` `.brand` `.brand-mark`
- `.side-nav` `.nav-item` `.nav-item.is-active` `.nav-subitem`
- `.nav-nested` `.nav-section-label` `.nav-icon`

### Topbar
- `.topbar` `.topbar-actions`

---

## 5. Archivos que NUNCA se modifican sin aprobación explícita

```
src/styles/global.css        ← fuente de verdad, solo lectura para IA
index.css                    ← estilos legacy, no tocar
tailwind.config.js           ← configuración de build, no tocar
src/layouts/OSLayout.tsx     ← estructura principal [STRUCTURAL]
src/layouts/AppShell.tsx     ← shell de la app [STRUCTURAL]
src/components/os/Sidebar.tsx   ← sidebar [STRUCTURAL]
src/components/os/Topbar.tsx    ← topbar [STRUCTURAL]
```

---

## 6. Al crear una página nueva

1. Usa `OSLayout` + `AppShell` como contenedor — no crear layout propio
2. Usa `.content` como wrapper del contenido de la página
3. Estructura la página con `.section` y `.section-head`
4. Usa `.page-header` para el encabezado de la vista
5. Usa `.grid-2` o `.grid-3` para columnas
6. Usa `.card` para agrupar contenido
7. Usa `.metric-card` para KPIs
8. **No crear clases CSS nuevas en el archivo de la página**

## 7. Al crear una tabla nueva

1. Usar el componente `Table.tsx` como base
2. Aplicar clase `.table` al elemento `<table>`
3. Headers con fondo `var(--color-neutral-100)`, texto uppercase, `var(--text-small-size)`
4. Valores monetarios con clase `.align-right` y `.tabular`
5. Badges de estado con `.badge .badge-{success|warning|danger|neutral}`
6. **No crear estilos de tabla nuevos**

---

## 8. Regla de oro

> Si el valor que necesitas no existe en `global.css`,
> propónlo primero. No lo inventes.