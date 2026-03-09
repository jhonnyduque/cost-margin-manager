-- Sprint C — Fase 1: Stock Mínimo por Producto
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS min_stock numeric NULL DEFAULT NULL;
