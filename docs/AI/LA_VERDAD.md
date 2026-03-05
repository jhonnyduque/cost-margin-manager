# ⚖️ REGLA: LA VERDAD ABSOLUTA (BETO OS)

Esta es una DIRECTIVA CORE de Inteligencia Artificial para el proyecto *Cost & Margin Manager* (Beto OS). 

**COMO IA QUE ASISTE EN ESTE PROYECTO, ESTÁS OBLIGADA A SEGUIR ESTOS PRINCIPIOS DE VERDAD:**

## 1. Cero Mock Data ("Prohibido Maquillar")
*   Queda **ROTUNDAMENTE PROHIBIDO** inventar, simular, maquillar o pre-calcular con valores constantes (hardcoding) cualquier gráfica, infografía, estadística o valor mostrado al usuario.
*   Si un dashboard, tarjeta o tabla necesita un número, **debe provenir obligatoriamente de Supabase** o una fuente de verdad similar (ej. Stripe).
*   Si no hay datos, se debe mostrar un estado vacío (ej. `$0`, `0%`, `No data`). **Nunca** insertar datos de relleno (placeholders) que parezcan reales.

## 2. Supabase es el Juez
*   La base de datos (Supabase) es la única fuente de la verdad para todo el flujo de ingresos, costos y métricas.
*   Toda lógica de métricas financieras (MRR, Churn, LTV, Growth, Cohorts) debe ser un cálculo puramente matemático construido sobre las filas registradas en las tablas originales (ej. `companies`, `subscription_events`, `subscription_plans`, etc.).
*   Cualquier duda de sincronización entre front-end y back-end se resuelve ejecutando queries crudos en Supabase. Si la base de datos dice `$10`, la UI debe mostrar `$10`.

## 3. Principio del Histórico Real
*   Nada de "arrays falsos de 6 meses" o fechas sintéticas para rellenar gráficos. 
*   Si la empresa más antigua nació el `2024-01-01`, ningún gráfico histórico puede pretender mostrar ingresos de `2023`.
*   El cálculo del tiempo se basa en los campos `created_at` y `deleted_at`, no en saltos lógicos inventados en JavaScript.

## 4. Transparencia Auditiva
*   Para métricas críticas (MRR), el sistema debe mantener o permitir la habilitación fácil de logs ("Modo Nuclear") donde la IA o el Super Admin puedan imprimir exactamente de qué filas de la BD proviene la suma o resta del cálculo.

> *"Asume la verdad y los datos confiables como principio de la verdad." - Beto*
