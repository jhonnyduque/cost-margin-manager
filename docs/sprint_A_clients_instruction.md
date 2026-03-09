# Sprint A — Módulo de Clientes (BETO OS)

## Contexto
BETO OS es una SaaS multi-tenant en React/TypeScript + Supabase + Zustand.
Este sprint crea el módulo de Clientes completo. Es prerequisito del módulo de Despachos.

---

## 1. Supabase — Crear tabla `clients`

Ejecutar en el SQL Editor de Supabase:

```sql
CREATE TABLE clients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id),
  name          text NOT NULL,
  email         text,
  phone         text,
  address       text,
  tax_id        text,
  notes         text,
  status        text NOT NULL DEFAULT 'activo'
                CHECK (status IN ('activo', 'inactivo')),
  created_at    timestamptz DEFAULT now(),
  created_by    uuid,
  updated_at    timestamptz,
  updated_by    uuid,
  deleted_at    timestamptz
);

-- RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_company_isolation" ON clients
  USING (company_id = (
    SELECT company_id FROM user_companies
    WHERE user_id = auth.uid() LIMIT 1
  ));
```

---

## 2. TypeScript — Agregar tipo `Client` en `src/types/index.ts`

```typescript
export interface Client {
  id: string;
  company_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  notes?: string;
  status: 'activo' | 'inactivo';
  created_at: string;
  created_by?: string | null;
  updated_at?: string;
  updated_by?: string | null;
  deleted_at?: string | null;
}
```

---

## 3. Store — Agregar en `src/store.ts`

### En la interfaz `AppState`, agregar:

```typescript
clients: Client[];
loadClientsFromSupabase: () => Promise<void>;
addClient: (client: Client) => Promise<void>;
updateClient: (client: Client) => Promise<void>;
deleteClient: (id: string) => Promise<void>;
archiveClient: (id: string) => Promise<void>;
```

### En `setCurrentCompany`, agregar llamada:
```typescript
get().loadClientsFromSupabase();
```

### En `logout`, agregar reset:
```typescript
clients: [],
```

### Implementaciones:

```typescript
clients: [],

loadClientsFromSupabase: async () => {
  const companyId = get().currentCompanyId;
  if (!companyId) return;
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('name');
  if (!error && data) set({ clients: data as Client[] });
},

addClient: async (client) => {
  const companyId = get().currentCompanyId;
  if (!companyId) return;
  const actorId = await getActorId();
  const { error } = await supabase.from('clients').insert({
    id: client.id,
    company_id: companyId,
    name: client.name,
    email: client.email || null,
    phone: client.phone || null,
    address: client.address || null,
    tax_id: client.tax_id || null,
    notes: client.notes || null,
    status: client.status,
    created_at: new Date().toISOString(),
    created_by: actorId,
    updated_by: actorId,
  });
  if (error) throw error;
  set((state) => ({ clients: [...state.clients, client].sort((a,b) => a.name.localeCompare(b.name)) }));
},

updateClient: async (client) => {
  const companyId = get().currentCompanyId;
  if (!companyId) return;
  const actorId = await getActorId();
  const { error } = await supabase.from('clients').update({
    name: client.name,
    email: client.email || null,
    phone: client.phone || null,
    address: client.address || null,
    tax_id: client.tax_id || null,
    notes: client.notes || null,
    status: client.status,
    updated_at: new Date().toISOString(),
    updated_by: actorId,
  })
  .eq('id', client.id)
  .eq('company_id', companyId);
  if (error) throw error;
  set((state) => ({
    clients: state.clients.map((c) => c.id === client.id ? client : c),
  }));
},

deleteClient: async (id) => {
  const actorId = await getActorId();
  const { error } = await supabase.from('clients')
    .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
    .eq('id', id)
    .eq('company_id', get().currentCompanyId);
  if (error) throw error;
  set((state) => ({ clients: state.clients.filter((c) => c.id !== id) }));
},

archiveClient: async (id) => {
  const actorId = await getActorId();
  const { error } = await supabase.from('clients')
    .update({ status: 'inactivo', updated_at: new Date().toISOString(), updated_by: actorId })
    .eq('id', id)
    .eq('company_id', get().currentCompanyId);
  if (error) throw error;
  set((state) => ({
    clients: state.clients.map((c) => c.id === id ? { ...c, status: 'inactivo' } : c),
  }));
},
```

---

## 4. Página `src/pages/Clients.tsx`

Crear página completa con:

### Layout
- PageHeader con título "Clientes" y botón "Nuevo Cliente" (variant="primary")
- Barra de búsqueda por nombre/email
- Tabla de clientes con columnas: Nombre, Email, Teléfono, Tax ID, Estado, Acciones
- Estado vacío con ícono Users y texto "Aún no tienes clientes registrados"
- Badge de estado: verde=activo, gris=inactivo

### Modal crear/editar (estado interno con useState)
- Campos: name (required), email, phone, address, tax_id, notes, status
- Botones: Cancelar / Guardar
- Validación: name no puede estar vacío
- En guardar: llama addClient o updateClient según corresponda

### Acciones por fila
- Editar (abre modal con datos del cliente)
- Archivar/Reactivar (toggle de status)
- Eliminar (con confirmación)

### Design system
- Usar EXACTAMENTE los mismos tokens que el resto de la app:
  `colors`, `typography`, `spacing`, `radius`, `shadows` de `@/design/design-tokens`
- Componentes: `Button`, `Badge`, `Card`, `PageHeader` de `@/components/ui/`
- NO inventar clases Tailwind nuevas fuera del design system

---

## 5. Routing — `src/App.tsx`

Agregar ruta:
```tsx
<Route path="/clientes" element={<Clients />} />
```

---

## 6. Sidebar — agregar ítem Clientes

Agregar en `src/components/layout/Sidebar.tsx` un ítem con:
- Ícono: `Users` de lucide-react
- Label: "Clientes"
- Path: `/clientes`
- Posición: después de Productos, antes de Inventario

---

## Restricciones absolutas
- NO tocar ningún archivo que no esté listado arriba
- NO modificar la lógica de productos, batches, inventario ni store existente (solo agregar)
- NO crear componentes extra no solicitados
- Respetar el patrón audit trail: siempre `created_by` y `updated_by` via `getActorId()`
- Respetar multi-tenant: siempre filtrar por `company_id`

## Entregables
1. SQL ejecutado en Supabase (confirmar)
2. `src/types/index.ts` actualizado
3. `src/store.ts` actualizado
4. `src/pages/Clients.tsx` creado
5. `src/App.tsx` actualizado
6. `src/components/layout/Sidebar.tsx` actualizado
