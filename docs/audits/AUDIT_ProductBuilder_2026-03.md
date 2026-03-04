# 🔍 Auditoría: ProductBuilder.tsx
**Fecha:** 2026-03-03  
**Responsable:** BETO OS Senior Team  
**Prioridad:** 🔴 Inmediata / 🟠 Urgente / 🟡 Mejora  

---

## 🎯 Objetivo del Debate
Validar e priorizar las mejoras de seguridad, arquitectura y UX propuestas para `ProductBuilder.tsx`.

---

## 📋 Hallazgos Clave (Para votar)

| # | Hallazgo | Impacto | Esfuerzo | Votos 👍 |
|---|----------|---------|----------|----------|
| 1 | Falta `updated_by` en mutaciones | 🔴 Alto | 🟢 Bajo | [ ] |
| 2 | Lógica de costeo duplicada localmente | 🟠 Medio | 🟡 Medio | [ ] |
| 3 | Conversión pieces→metros no centralizada | 🟠 Medio | 🟢 Bajo | [ ] |
| 4 | Panel de "Production Readiness" ausente | 🟡 Bajo | 🟡 Medio | [ ] |
| 5 | Inputs numéricos con mala UX móvil | 🟡 Bajo | 🟢 Bajo | [ ] |

---

## 🗳️ Decisiones a Tomar (Checklist de equipo)

### [IMMEDIATE] Fase 1: Seguridad
- [ ] ¿Aprobamos añadir `updated_by` vía `supabase.auth.getUser()`?
- [ ] ¿Implementamos guard de `currentCompanyId` antes de guardar?

### [URGENT] Fase 2: Arquitectura
- [ ] ¿Eliminamos `calculateTotalCost` local y usamos el store?
- [ ] ¿Creamos `src/utils/materialCalculations.ts` para lógica de piezas?

### [IMPROVEMENT] Fase 3: UX
- [ ] ¿Aprobamos el panel "Production Readiness" en sidebar?
- [ ] ¿Cambiamos inputs a `inputMode="decimal"` con manejo de coma?

---

## 🧪 Criterios de Aceptación (Para QA)
- [ ] Al guardar, el payload incluye `updated_by: "<user-uuid>"`
- [ ] Sin `currentCompanyId`, el sistema muestra error y no guarda
- [ ] El costo calculado coincide con el motor financiero centralizado
- [ ] Inputs numéricos aceptan coma y punto en móvil sin romper el valor

---

## 💬 Notas del Debate
*(Espacio para comentarios del equipo durante la reunión)*

> **Acción post-reunión:** Asignar responsables y fechas límite a cada ítem aprobado.