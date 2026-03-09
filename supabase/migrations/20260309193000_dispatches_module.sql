-- 🚚 SPRINT B: MÓDULO DE DESPACHOS

-- 1. Tabla de Cabecera de Despachos
CREATE TABLE IF NOT EXISTS public.dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name TEXT, -- Snapshot para el PDF
    notes TEXT,
    status TEXT NOT NULL CHECK (status IN ('borrador', 'confirmado', 'anulado')),
    total_value DECIMAL(12,2) NOT NULL DEFAULT 0,
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES auth.users(id),
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ,
    updated_by UUID REFERENCES auth.users(id),
    deleted_at TIMESTAMPTZ
);

-- 2. Tabla de Detalle de Despachos (Items)
CREATE TABLE IF NOT EXISTS public.dispatch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id UUID NOT NULL REFERENCES public.dispatches(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    product_name TEXT, -- Snapshot
    quantity DECIMAL(12,2) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Habilitar RLS
ALTER TABLE public.dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_items ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad (Multi-tenant)
-- Nota: Usamos la función public.user_companies() existente para aislamiento.

CREATE POLICY "dispatches_isolation_policy" ON public.dispatches
    USING (company_id IN (SELECT public.user_companies()));

CREATE POLICY "dispatch_items_isolation_policy" ON public.dispatch_items
    USING (company_id IN (SELECT public.user_companies()));

-- 5. Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_dispatches_company ON public.dispatches(company_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_client ON public.dispatches(client_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_dispatch ON public.dispatch_items(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_product ON public.dispatch_items(product_id);
