-- ============================================================
-- BACKFILL: Migrar proveedores existentes de raw_materials
-- y material_batches hacia la tabla suppliers.
-- 
-- Ejecutar UNA VEZ en Supabase SQL Editor.
-- Solo inserta nombres que NO existan ya en suppliers.
-- ============================================================

-- Paso 1: Identificar el company_id de la empresa DEMO
-- (Ajustar si hay varias empresas)
WITH target_company AS (
  SELECT id AS company_id
  FROM companies
  WHERE name ILIKE '%Particulart%'
  LIMIT 1
),

-- Paso 2: Recopilar todos los nombres únicos de proveedor
distinct_providers AS (
  SELECT DISTINCT TRIM(provider) AS provider_name
  FROM (
    -- Desde raw_materials
    SELECT provider
    FROM raw_materials
    WHERE company_id = (SELECT company_id FROM target_company)
      AND provider IS NOT NULL
      AND TRIM(provider) <> ''
      AND deleted_at IS NULL

    UNION

    -- Desde material_batches (pueden tener proveedores distintos)
    SELECT provider
    FROM material_batches
    WHERE company_id = (SELECT company_id FROM target_company)
      AND provider IS NOT NULL
      AND TRIM(provider) <> ''
      AND deleted_at IS NULL
  ) all_providers
),

-- Paso 3: Filtrar los que ya existen en suppliers
new_providers AS (
  SELECT dp.provider_name
  FROM distinct_providers dp
  WHERE NOT EXISTS (
    SELECT 1
    FROM suppliers s
    WHERE s.company_id = (SELECT company_id FROM target_company)
      AND LOWER(TRIM(s.name)) = LOWER(dp.provider_name)
  )
)

-- Paso 4: Insertar los nuevos
INSERT INTO suppliers (company_id, name, status, created_at, updated_at)
SELECT
  (SELECT company_id FROM target_company),
  provider_name,
  'activo',
  NOW(),
  NOW()
FROM new_providers
ORDER BY provider_name;

-- Verificar resultado
SELECT name, status, created_at
FROM suppliers
WHERE company_id = (SELECT id FROM companies WHERE name ILIKE '%Particulart%' LIMIT 1)
ORDER BY name;
