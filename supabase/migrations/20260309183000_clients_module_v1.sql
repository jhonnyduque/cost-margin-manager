CREATE TABLE IF NOT EXISTS clients (
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

-- Policy (following existing patterns)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'clients' AND policyname = 'clients_isolation_policy'
    ) THEN
        CREATE POLICY "clients_isolation_policy" ON clients
          USING (company_id IN (SELECT public.user_companies()));
    END IF;
END
$$;
