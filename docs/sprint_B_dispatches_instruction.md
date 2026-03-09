# Sprint B — Módulo de Despachos (BETO OS)

## Contexto
BETO OS es una SaaS multi-tenant en React/TypeScript + Supabase + Zustand.
Las tablas `dispatches` y `dispatch_items` ya existen en Supabase.
La tabla `clients` ya existe. El tipo `Client` ya existe en `src/types/index.ts`.
Este sprint construye el módulo completo de Despachos.

---

## 1. Tipos TypeScript — agregar en `src/types/index.ts`

```typescript
export interface DispatchItem {
  id: string;
  dispatch_id: string;
  company_id: string;
  product_id: string;
  product_name?: string;      // snapshot al confirmar
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string;
  created_at: string;
}

export interface Dispatch {
  id: string;
  company_id: string;
  number: string;             // 'DESP-2026-001'
  date: string;
  client_id?: string | null;
  client_name?: string | null; // snapshot al confirmar
  notes?: string | null;
  status: 'borrador' | 'confirmado' | 'anulado';
  total_value: number;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  created_at: string;
  created_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  // relación local (no en DB)
  items?: DispatchItem[];
}
```

---

## 2. Store — agregar en `src/store.ts`

### En la interfaz `AppState`, agregar:

```typescript
dispatches: Dispatch[];
loadDispatchesFromSupabase: () => Promise<void>;
createDispatch: (dispatch: Dispatch, items: DispatchItem[]) => Promise<void>;
updateDispatch: (dispatch: Dispatch, items: DispatchItem[]) => Promise<void>;
confirmDispatch: (dispatchId: string) => Promise<void>;
cancelDispatch: (dispatchId: string) => Promise<void>;
deleteDispatch: (id: string) => Promise<void>;
generateDispatchNumber: () => string;
```

### En `setCurrentCompany`, agregar:
```typescript
get().loadDispatchesFromSupabase();
```

### En `logout`, agregar:
```typescript
dispatches: [],
```

### Implementaciones:

```typescript
dispatches: [],

generateDispatchNumber: () => {
  const year = new Date().getFullYear();
  const existing = get().dispatches
    .filter(d => d.number.startsWith(`DESP-${year}-`))
    .map(d => parseInt(d.number.split('-')[2] || '0', 10))
    .filter(n => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `DESP-${year}-${String(next).padStart(3, '0')}`;
},

loadDispatchesFromSupabase: async () => {
  const companyId = get().currentCompanyId;
  if (!companyId) return;

  const { data: dispatchData, error } = await supabase
    .from('dispatches')
    .select('*')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error || !dispatchData) return;

  const { data: itemsData } = await supabase
    .from('dispatch_items')
    .select('*')
    .eq('company_id', companyId);

  const dispatches = dispatchData.map(d => ({
    ...d,
    items: (itemsData || []).filter(i => i.dispatch_id === d.id)
  }));

  set({ dispatches: dispatches as Dispatch[] });
},

createDispatch: async (dispatch, items) => {
  const companyId = get().currentCompanyId;
  if (!companyId) return;
  const actorId = await getActorId();

  const { error: dispatchError } = await supabase.from('dispatches').insert({
    id: dispatch.id,
    company_id: companyId,
    number: dispatch.number,
    date: dispatch.date,
    client_id: dispatch.client_id || null,
    client_name: dispatch.client_name || null,
    notes: dispatch.notes || null,
    status: 'borrador',
    total_value: dispatch.total_value,
    created_at: new Date().toISOString(),
    created_by: actorId,
    updated_by: actorId,
  });
  if (dispatchError) throw dispatchError;

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from('dispatch_items').insert(
      items.map(item => ({
        id: item.id,
        dispatch_id: dispatch.id,
        company_id: companyId,
        product_id: item.product_id,
        product_name: item.product_name || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        notes: item.notes || null,
        created_at: new Date().toISOString(),
      }))
    );
    if (itemsError) throw itemsError;
  }

  const newDispatch = { ...dispatch, items, status: 'borrador' as const };
  set(state => ({ dispatches: [newDispatch, ...state.dispatches] }));
},

updateDispatch: async (dispatch, items) => {
  const companyId = get().currentCompanyId;
  if (!companyId) return;
  const actorId = await getActorId();

  const { error: dispatchError } = await supabase.from('dispatches').update({
    date: dispatch.date,
    client_id: dispatch.client_id || null,
    client_name: dispatch.client_name || null,
    notes: dispatch.notes || null,
    total_value: dispatch.total_value,
    updated_at: new Date().toISOString(),
    updated_by: actorId,
  })
  .eq('id', dispatch.id)
  .eq('company_id', companyId);
  if (dispatchError) throw dispatchError;

  // Reemplazar items: borrar anteriores e insertar nuevos
  await supabase.from('dispatch_items').delete().eq('dispatch_id', dispatch.id);

  if (items.length > 0) {
    await supabase.from('dispatch_items').insert(
      items.map(item => ({
        id: item.id,
        dispatch_id: dispatch.id,
        company_id: companyId,
        product_id: item.product_id,
        product_name: item.product_name || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        notes: item.notes || null,
        created_at: new Date().toISOString(),
      }))
    );
  }

  set(state => ({
    dispatches: state.dispatches.map(d =>
      d.id === dispatch.id ? { ...dispatch, items } : d
    )
  }));
},

confirmDispatch: async (dispatchId) => {
  const companyId = get().currentCompanyId;
  const actorId = await getActorId();
  const now = new Date().toISOString();

  const dispatch = get().dispatches.find(d => d.id === dispatchId);
  if (!dispatch || dispatch.status !== 'borrador') return;

  const items = dispatch.items || [];

  // Validar stock suficiente para todos los items ANTES de confirmar
  for (const item of items) {
    const movements = get().productMovements.filter(m => m.product_id === item.product_id);
    const stock = movements.reduce((acc, m) => {
      if (m.type === 'ingreso_produccion') return acc + m.quantity;
      if (m.type === 'salida_venta') return acc - m.quantity;
      if (m.type === 'ajuste') return acc + m.quantity;
      return acc;
    }, 0);
    if (item.quantity > stock) {
      const product = get().products.find(p => p.id === item.product_id);
      throw new Error(`Stock insuficiente para "${product?.name || item.product_id}". Disponible: ${stock}, requerido: ${item.quantity}`);
    }
  }

  // Actualizar estado del despacho
  const { error } = await supabase.from('dispatches').update({
    status: 'confirmado',
    confirmed_at: now,
    confirmed_by: actorId,
    client_name: dispatch.client_id
      ? (get().clients.find(c => c.id === dispatch.client_id)?.name || dispatch.client_name)
      : dispatch.client_name,
    updated_at: now,
    updated_by: actorId,
  })
  .eq('id', dispatchId)
  .eq('company_id', companyId);
  if (error) throw error;

  // Registrar product_movements de tipo 'salida_venta' por cada item
  const newMovements = items.map(item => ({
    id: crypto.randomUUID(),
    company_id: companyId,
    product_id: item.product_id,
    type: 'salida_venta',
    quantity: item.quantity,
    unit_cost: item.unit_price,
    reference: `Despacho ${dispatch.number}`,
    created_at: now,
    produced_with_debt: false,
  }));

  const { error: movError } = await supabase.from('product_movements').insert(newMovements);
  if (movError) throw movError;

  set(state => ({
    dispatches: state.dispatches.map(d =>
      d.id === dispatchId
        ? { ...d, status: 'confirmado', confirmed_at: now, confirmed_by: actorId }
        : d
    ),
    productMovements: [...newMovements, ...state.productMovements] as any,
  }));
},

cancelDispatch: async (dispatchId) => {
  const companyId = get().currentCompanyId;
  const actorId = await getActorId();
  const now = new Date().toISOString();

  const dispatch = get().dispatches.find(d => d.id === dispatchId);
  if (!dispatch) return;

  const { error } = await supabase.from('dispatches').update({
    status: 'anulado',
    cancelled_at: now,
    cancelled_by: actorId,
    updated_at: now,
    updated_by: actorId,
  })
  .eq('id', dispatchId)
  .eq('company_id', companyId);
  if (error) throw error;

  // Si estaba confirmado, revertir los product_movements con movimientos inversos
  if (dispatch.status === 'confirmado') {
    const items = dispatch.items || [];
    const reversals = items.map(item => ({
      id: crypto.randomUUID(),
      company_id: companyId,
      product_id: item.product_id,
      type: 'ajuste',
      quantity: item.quantity,   // positivo = devuelve al stock
      unit_cost: item.unit_price,
      reference: `Anulación ${dispatch.number}`,
      created_at: now,
      produced_with_debt: false,
    }));
    await supabase.from('product_movements').insert(reversals);
    set(state => ({
      dispatches: state.dispatches.map(d =>
        d.id === dispatchId ? { ...d, status: 'anulado', cancelled_at: now } : d
      ),
      productMovements: [...reversals, ...state.productMovements] as any,
    }));
  } else {
    set(state => ({
      dispatches: state.dispatches.map(d =>
        d.id === dispatchId ? { ...d, status: 'anulado', cancelled_at: now } : d
      ),
    }));
  }
},

deleteDispatch: async (id) => {
  const actorId = await getActorId();
  const dispatch = get().dispatches.find(d => d.id === id);
  // Solo se puede eliminar si está en borrador
  if (dispatch?.status !== 'borrador') {
    throw new Error('Solo se pueden eliminar despachos en estado borrador.');
  }
  const { error } = await supabase.from('dispatches')
    .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
    .eq('id', id)
    .eq('company_id', get().currentCompanyId);
  if (error) throw error;
  set(state => ({ dispatches: state.dispatches.filter(d => d.id !== id) }));
},
```

---

## 3. Página `src/pages/Dispatches.tsx`

### Layout general
- PageHeader: título "Despachos", descripción "Notas de entrega y registro de salidas"
- Botón "Nuevo Despacho" (variant="primary", ícono FileText)
- Tabs o filtros por estado: Todos / Borrador / Confirmado / Anulado
- Tabla con columnas: Número, Fecha, Cliente, Items, Total, Estado, Acciones

### Tabla de despachos
- Badge de estado: azul=borrador, verde=confirmado, rojo=anulado
- Columna acciones según estado:
  - `borrador`: Editar, Confirmar, Eliminar
  - `confirmado`: Ver detalle, Anular, Exportar PDF
  - `anulado`: Ver detalle (solo lectura)

### Estado vacío
- Ícono FileText, texto "No hay despachos registrados aún"

---

## 4. Modal `DispatchModal.tsx` (crear/editar borrador)

### Estructura del modal (pantalla completa o drawer grande)
- Header: "Nuevo Despacho" / "Editar Despacho DESP-2026-001"
- Campo: Número (auto-generado, readonly)
- Campo: Fecha (date input, default hoy)
- Campo: Cliente (selector dropdown de `clients` activos, con opción "Sin cliente")
- Campo: Notas generales (textarea)

### Tabla de productos a despachar
- Columnas: Producto (selector), Cantidad, Precio Unitario, Subtotal, Notas, Eliminar
- Botón "+ Agregar Producto"
- Al seleccionar producto: precio unitario se pre-llena con `product.price`
- Subtotal = cantidad × precio unitario (calculado automático)
- Validación inline: cantidad no puede superar stock disponible (mostrar stock disponible al lado)
- Total general visible al pie de la tabla

### Footer del modal
- Izquierda: Total del despacho en grande
- Derecha: botón Cancelar + botón "Guardar Borrador"

---

## 5. Componente `DispatchDetail.tsx` (vista detalle + PDF)

### Vista detalle (modal o página)
Mostrar como documento formal:
- Header: logo placeholder + nombre empresa (del store o hardcoded "Mi Empresa" por ahora)
- Número, fecha, estado
- Datos del cliente (nombre, email, teléfono, dirección si existen)
- Tabla: Producto | Cantidad | Precio Unit. | Subtotal
- Total general
- Notas si existen
- Pie: "Confirmado por: [nombre]" + fecha y hora

### Botones (solo en confirmado)
- "Exportar PDF" — usa `window.print()` con CSS `@media print` que oculta todo excepto el documento
- "Imprimir" — igual que exportar PDF
- "Anular Despacho" — con modal de confirmación ("¿Estás seguro? Esta acción revertirá el stock.")

---

## 6. Routing — `src/App.tsx`

```tsx
<Route path="/despachos" element={<Dispatches />} />
```

---

## 7. Sidebar — `src/components/layout/Sidebar.tsx`

Agregar ítem:
- Ícono: `FileText` de lucide-react
- Label: "Despachos"
- Path: `/despachos`
- Posición: después de Clientes

---

## Restricciones absolutas
- NO tocar lógica de productos, batches, stock de materias primas ni ningún módulo existente
- NO agregar "salida rápida" ni nada parecido a módulos existentes
- La única forma de registrar una salida de producto terminado es a través de `confirmDispatch`
- Respetar design system: tokens de `@/design/design-tokens`, componentes de `@/components/ui/`
- Respetar multi-tenant: siempre `company_id` en todas las operaciones
- Respetar audit trail: `created_by` y `updated_by` via `getActorId()`
- El PDF usa `window.print()` con estilos CSS `@media print` — NO instalar librerías externas

## Entregables
1. `src/types/index.ts` actualizado
2. `src/store.ts` actualizado
3. `src/pages/Dispatches.tsx` creado
4. `src/components/dispatches/DispatchModal.tsx` creado
5. `src/components/dispatches/DispatchDetail.tsx` creado
6. `src/App.tsx` actualizado
7. `src/components/layout/Sidebar.tsx` actualizado
