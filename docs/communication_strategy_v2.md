# 📡 PLAN DE COMUNICACIÓN BETO OS v2.1
## Sistema de Comunicación Accionable, Medible y Oportuna

================================================================

🎯 PRINCIPIO RECTOR
================================================================
"Toda comunicación debe ser accionable, medible y oportuna"

Pilares:
• ACCIONABLE → Cada mensaje tiene un CTA claro
• MEDIBLE → Trackeamos apertura, click, conversión Y acción completada
• OPORTUNA → Respetamos timezone, horario laboral y frecuencia
• RELEVANTE → Segmentación por rol, comportamiento y contexto

================================================================

🔍 DIAGNÓSTICO: ESTADO ACTUAL
================================================================

✅ COMPONENTES EXISTENTES (con mejoras propuestas)

| Componente                  | Estado    | Ubicación                              | Mejora Propuesta                        |
|-----------------------------|-----------|----------------------------------------|-----------------------------------------|
| Event Bus                   | ✅ Activo | event_bus + events.ts                  | Agregar priority + ttl                  |
| Notificaciones In-App       | ✅ Activo | notifications + notificationService.ts | Agrupación + digest                     |
| Suscripción Realtime        | ✅ Activo | notificationService.ts                 | Reconexión + queue offline              |
| Notification Listener       | ✅ Activo | notificationListener.ts                | Activar 8 listeners faltantes           |
| Preferencias Notificación   | ✅ Esquema| notification_preferences               | Granularidad por canal + frecuencia     |
| Broadcast Global            | ✅ Activo | PlatformAdmin.tsx                      | Segmentación por plan/empresa           |
| Formulario Contacto         | ⚠️ Visual| HelpPage.tsx                           | Conectar a backend + ticket system      |
| Lectura Individual          | ✅ Activo | notification_reads                     | Analytics de engagement                 |

📊 EVENTOS DEFINIDOS (12 tipos) — CON PRIORIZACIÓN

| Módulo     | Evento               | Prioridad | Notificación | Canal Sugerido           |
|------------|----------------------|-----------|--------------|--------------------------|
| Inventario | LOW_STOCK            | High      | ✅           | In-App + WhatsApp*       |
| Inventario | COST_DEVIATION       | Medium    | ❌→✅        | In-App (dashboard)       |
| Team       | USER_INVITED         | Low       | ✅           | In-App + Email           |
| Team       | USER_JOINED          | Low       | ❌→✅        | In-App (admin only)      |
| Team       | SEAT_LIMIT_REACHED   | High      | ❌→✅        | In-App + Email           |
| Billing    | PAYMENT_FAILED       | Critical  | ✅           | In-App + Email + WhatsApp*|
| Billing    | SUBSCRIPTION_RENEWED | Medium    | ❌→✅        | Email + In-App           |
| Billing    | INVOICE_READY        | Medium    | ❌→✅        | Email + In-App           |
| System     | NEW_SIGNUP           | Low       | ❌→✅        | Email (admin)            |
| System     | SYSTEM_ERROR         | Critical  | ❌→✅        | In-App + Email (admin)   |
| System     | MAINTENANCE_ALERT    | High      | ✅           | In-App + Email + WhatsApp*|
| System     | PLATFORM_NOTICE      | Low       | ❌→✅        | In-App (broadcast)       |

* WhatsApp outbound: SOLO para eventos críticos, billing sensible, 
  incidencias de alto impacto y onboarding muy acotado.

================================================================

❌ GAP ANALYSIS: LO QUE NO EXISTE
================================================================

| Componente                  | Estado | Impacto    | Prioridad |
|-----------------------------|--------|------------|-----------|
| WhatsApp Integration        | No hay | Alto       | P1        |
| Comentarios en Entidades    | No hay | Crítico    | P0        |
| Avisos Internos Empresa     | No hay | Medio      | P2        |
| Email Delivery Service      | No hay | Alto       | P1        |
| Backend Formulario Contacto | No hay | Alto       | P0        |
| Analytics de Comunicación   | No hay | Medio      | P2        |
| Template System             | No hay | Medio      | P2        |
| Notification Center UI      | Parcial| Alto       | P1        |
| Changelog / What's New      | No hay | Medio      | P3        |
| Onboarding Sequence         | No hay | Alto       | P1        |

================================================================

🏗️ ARQUITECTURA: 5 CANALES
================================================================

CANAL 1 — Plataforma ↔ Empresa (Enhanced)
-----------------------------------------
| Dirección          | Medio                    | Ejemplo                        | Frecuencia Máx |
|--------------------|--------------------------|--------------------------------|----------------|
| BETO OS → Empresa  | Broadcast in-app         | "Mantenimiento programado"     | 1/semana       |
| BETO OS → Empresa  | WhatsApp Business API*   | "Suscripción vence en 3 días"  | 1/evento crítico|
| BETO OS → Empresa  | Email Transactional      | "Factura disponible"           | 1/evento billing|
| Empresa → BETO OS  | Botón WhatsApp Sidebar   | "Necesito ayuda con producción"| Ilimitado      |
| Empresa → BETO OS  | Formulario Soporte       | "Bug report / Feature request" | Ilimitado      |

* WhatsApp Outbound — Reglas Estrictas:
  ✅ Permitido para:
    • Eventos críticos (SYSTEM_ERROR, PAYMENT_FAILED)
    • Billing sensible (vencimiento, fallo de pago)
    • Incidencias de alto impacto (downtime, seguridad)
    • Onboarding muy acotado (primeros 3 mensajes)
  
  ❌ NO permitido para:
    • Recordatorios frecuentes
    • Comunicación "normal" o promocional
    • Notificaciones operativas de rutina
    • Marketing o upsell

  Razón: Control de costos + evitar desgaste del canal + 
         mantener percepción de urgencia cuando sí se usa.

CANAL 2 — Comunicación Interna de Empresa (Enhanced)
----------------------------------------------------
🛡️ GUARDRAIL EXPLÍCITO:
"Anuncios, tareas y alertas — NO conversación abierta tipo chat"

| Quién Envía     | A Quién           | Tipo              | Ejemplo                    | Aprobación |
|-----------------|-------------------|-------------------|----------------------------|------------|
| Admin/Owner     | Todo el equipo    | Anuncio           | "Mañana inventario general"| ❌         |
| Manager         | Operadores        | Tarea             | "Registrar lote de tela"   | ❌         |
| Sistema         | Roles específicos | Alerta automática | "Stock de Guata bajo"      | ❌         |
| Admin/Owner     | Empresa→BETO OS   | Escalamiento      | "Bug crítico en producción"| ✅         |

Implementación: Panel simple en Dashboard → "Avisos del Equipo" 
con historial. Sin hilo de respuestas, sin menciones en tiempo real, 
sin indicador de "escribiendo...".

CANAL 3 — Comentarios Contextuales (El Diferenciador — Enhanced)
----------------------------------------------------------------
🗄️ ESQUEMA DE DATOS (definido desde el inicio para estructura sólida):

CREATE TABLE entity_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  entity_type TEXT NOT NULL,        -- 'raw_material', 'batch', 'product', 'production_order'
  entity_id UUID NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active',     -- 'active', 'resolved'
  resolved_at TIMESTAMPTZ,          -- NULL si no está resuelto
  parent_id UUID,                   -- FUTURO: para respuestas/hilos (nullable)
  content TEXT NOT NULL
);

| Entidad              | Ejemplo de Comentario                  | Visibilidad  | Retención |
|----------------------|----------------------------------------|--------------|-----------|
| Materia Prima        | "Proveedor subió precio 15%"           | Company-only | 24 meses  |
| Lote                 | "Defecto en color, usar solo interno"  | Company-only | 24 meses  |
| Producto             | "Cliente pidió modificar empaque"      | Company-only | 24 meses  |
| Orden de Producción  | "Faltó 1 metro, completado con lote X" | Company-only | 24 meses  |

Mejoras vs Original:
• ✅ @mentions para notificar usuarios específicos (Fase 2+)
• ✅ Reacciones (👍, ⚠️, ✅) para feedback rápido (Fase 2+)
• ✅ Resolución (marcar comentario como "resuelto")
• ✅ Búsqueda full-text en comentarios de la empresa
• ✅ parent_id preparado para hilos (implementar cuando haya demanda)

CANAL 4 — Email Transactional (Nuevo)
-------------------------------------
| Trigger              | Template                 | Canal Alternativo |
|----------------------|--------------------------|-------------------|
| Welcome / Onboarding | welcome_v1               | In-App            |
| Payment Failed       | payment_failed_v1        | WhatsApp*         |
| Invoice Ready        | invoice_ready_v1         | In-App            |
| Subscription Renewing| renewal_reminder_v1      | WhatsApp*         |
| Password Reset       | password_reset_v1        | N/A               |
| Security Alert       | security_alert_v1        | WhatsApp* + SMS   |

* Solo si usuario dio opt-in explícito para WhatsApp.

CANAL 5 — Analytics & Feedback (Nuevo)
--------------------------------------
| Métrica                    | Objetivo      | Herramienta           |
|----------------------------|---------------|-----------------------|
| Open Rate (Email)          | >65%          | Postmark/SendGrid     |
| Click Rate (In-App)        | >40%          | Internal tracking     |
| Response Time (Soporte)    | <4 horas      | WhatsApp Business     |
| Notification Fatigue       | <5/día/user   | Rate limiting         |
| Support Satisfaction       | >4.5/5        | Post-interaction survey|
| ACTION COMPLETION RATE     | >50%          | Custom event tracking |

================================================================

🚀 ROADMAP DE IMPLEMENTACIÓN (OPTIMIZADO)
================================================================

📦 FASE 0-A — Foundation Operativa (2 semanas)
----------------------------------------------
Objetivo: Activar infraestructura crítica sin sobrecargar el equipo.

• Activar 8 listeners faltantes del Event Bus (prioridad: Critical/High primero)
• Conectar HelpPage a backend + tabla support_tickets
• Agregar campo `priority` (low/medium/high/critical) a Event Bus
• Tests unitarios para listeners activados

✅ Criterio de salida: Todos los eventos Critical/High generan notificación.

📦 FASE 0-B — Foundation de Contenido (2 semanas)
-------------------------------------------------
Objetivo: Preparar la capa de mensajería consistente.

• Template system básico con versionado (tabla notification_templates)
• Función renderTemplate(templateId, variables)
• Agregar campo `ttl_hours` para auto-expiración de notificaciones
• UI mínima para admin editar templates (PlatformAdmin)

✅ Criterio de salida: Templates renderizables + preferencias por canal.

📦 FASE 1 - Quick Wins (3 semanas)
----------------------------------
• Botón WhatsApp en Sidebar con pre-llenado inteligente
• Email transactional con Postmark/Resend (warm-up incluido)
• Notification Center UI mejorado con agrupación por día
• Preferencias de notificación por canal + frecuencia (Settings page)

📦 FASE 2 - Valor Operativo (6 semanas)
---------------------------------------
• Comentarios en Materias Primas (schema + UI básica)
• Comentarios en Lotes/Productos/Órdenes
• Resolución de comentarios + búsqueda full-text
• @mentions + reacciones (solo si hay demanda validada)

📦 FASE 3 - Equipo (4 semanas)
------------------------------
• Avisos internos de empresa con historial
• Alertas automáticas configurables por rol
• Digest diario para evitar notificación fatigue

📦 FASE 4 - Premium (6 semanas)
-------------------------------
• WhatsApp Business API (outbound templated) — con límites estrictos
• Analytics dashboard con KPIs en tiempo real (incluye Action Completion Rate)
• Onboarding email sequence automatizada

📦 FASE 5 - Enterprise (4 semanas)
----------------------------------
• SLA tracking para soporte
• Changelog / What's New in-app
• A/B testing de templates + rollback

================================================================

📐 REGLAS DE SEGURIDAD & GOBERNANZA
================================================================

| Regla                  | Descripción                                    | Enforcement              |
|------------------------|------------------------------------------------|--------------------------|
| Aislamiento Total      | Empresa A nunca ve datos/mensajes de Empresa B | Row Level Security (RLS) |
| Permisos por Rol       | Solo Admin/Owner/Manager envían avisos         | RBAC + Policy checks     |
| Comentarios por Membresía| Solo miembros activos pueden comentar         | Membership validation    |
| WhatsApp Solo Plataforma| Botón conecta exclusivamente con soporte BETO OS| Hardcoded + validation  |
| WhatsApp Outbound Limitado| Solo critical/billing/onboarding acotado    | Business logic + audit log|
| Rate Limiting          | Máx 5 notificaciones/día/user (no críticas)    | Queue + throttling       |
| Data Retention         | Comentarios: 24 meses, Notificaciones: 12 meses| Automated cleanup job    |
| GDPR Compliance        | Opt-in explícito para WhatsApp/Email           | Preference center        |
| Message Approval       | Broadcasts globales requieren 2 admins         | Dual approval workflow   |

================================================================

🎨 TONE OF VOICE & MESSAGING GUIDELINES
================================================================

| Contexto              | Tono                    | Ejemplo                                              |
|-----------------------|-------------------------|------------------------------------------------------|
| Alertas Críticas      | Directo, urgente        | "⚠️ Pago fallido. Tu cuenta será suspendida en 48h"  |
| Notificaciones Operativas| Neutral, informativo | "📦 Lote #1234 registrado exitosamente"              |
| Soporte               | Empático, resolutivo    | "👋 Hola [Nombre], estamos revisando tu caso. ETA: 2h"|
| Broadcasts            | Profesional, transparente| "📢 Mantenimiento: 28/03 02:00-04:00 CLT"            |
| Onboarding            | Amigable, guiado        | "🎉 ¡Bienvenido! Completa estos 3 pasos para empezar"|

================================================================

📊 KPIS & SUCCESS METRICS
================================================================

| KPI                           | Baseline | Target (90 días) | Owner    |
|-------------------------------|----------|------------------|----------|
| Notification Open Rate        | N/A      | >75%             | Product  |
| Click Rate (CTA)              | N/A      | >40%             | Product  |
| ACTION COMPLETION RATE ⭐     | N/A      | >50%             | Product  |
| Support Response Time         | N/A      | <4 horas         | Support  |
| Support Satisfaction (CSAT)   | N/A      | >4.5/5           | Support  |
| Feature Adoption (Comments)   | 0%       | >40% empresas    | Product  |
| Email Deliverability          | N/A      | >98%             | Engineering|
| Notification Fatigue Complaints| N/A     | <1% usuarios     | Product  |
| Churn Reduction (Comms)       | N/A      | -15%             | Growth   |

📝 Definición de Action Completion Rate:
"Porcentaje de notificaciones/mensajes donde el usuario completa 
la acción esperada dentro de las 24h posteriores a la recepción."

Ejemplos de tracking:
• Notificación "Stock bajo" → Usuario crea orden de compra = ✅ Completado
• Email "Factura lista" → Usuario descarga PDF = ✅ Completado  
• Alerta "Mantenimiento" → Usuario confirma lectura = ✅ Completado
• WhatsApp "Pago fallido" → Usuario actualiza método de pago = ✅ Completado

Implementación: Custom event `notification_action_completed` con 
metadata: {notification_id, expected_action, completed_at, user_id}

================================================================

❌ LO QUE NO HAREMOS (GUARDRAILS)
================================================================

| Evitar                        | En su lugar                          | Razón                        |
|-------------------------------|--------------------------------------|------------------------------|
| Chat libre tipo WhatsApp      | Comentarios estructurados por entidad| Evitar ruido, mantener contexto|
| Mensajería entre empresas     | Aislamiento multi-tenant estricto    | Seguridad + compliance       |
| Notificaciones excesivas      | Rate limiting + digest diario        | Evitar fatiga + churn        |
| Sistema de tickets complejo   | WhatsApp + formulario simple         | Velocidad > burocracia       |
| Emails promocionales spam     | Solo transaccionales + onboarding    | Respetar inbox del usuario   |
| Notificaciones push browser   | In-App + Email + WhatsApp            | Menos intrusivo, más efectivo|
| Templates sin versionado      | Template system con versionado       | A/B testing + rollback       |
| Canal 2 como chat abierto     | Anuncios/tareas/alertas unidireccionales| Proteger foco operativo    |

================================================================

🛠️ STACK TÉCNICO RECOMENDADO
================================================================

| Componente          | Herramienta              | Costo Estimado   | Alternativa          | Notas                    |
|---------------------|--------------------------|------------------|----------------------|--------------------------|
| Email Transactional | Postmark                 | $10-50/mes       | SendGrid, Resend     | Warm-up requerido        |
| WhatsApp Business   | Meta WhatsApp API        | $0.005-0.01/msg  | Twilio               | Solo outbound crítico    |
| Analytics           | PostHog (self-hosted) ⚠️ | $0 (open source) | Mixpanel, Amplitude  | ⚠️ Validar capacidad operativa del equipo antes de self-hosted. Alternativa: PostHog Cloud free tier o simple event logging interno. |
| Realtime            | Supabase Realtime        | Incluido         | Pusher, Ably         |                          |
| Queue System        | Supabase Edge Functions  | Incluido         | Bull, Redis          |                          |
| Template Management | Custom DB + UI           | $0 (dev time)    | Resend Templates     |                          |

⚠️ Nota sobre PostHog self-hosted:
Esta decisión debe validarse contra la capacidad real del equipo para 
operar infraestructura adicional. En fase temprana, priorizar:
1. Logging interno de eventos clave + dashboard simple
2. PostHog Cloud free tier (hasta 1M events/mes gratis)
3. Self-hosted solo cuando haya dedicación DevOps confirmada

================================================================

📋 CHECKLIST IMPLEMENTACIÓN FASE 0-A (Foundation Operativa)
================================================================

## Fase 0-A - Foundation Operativa (2 semanas)

### Event Bus — Prioridad
- [ ] Agregar campo `priority` ENUM('low','medium','high','critical')
- [ ] Modificar listeners para filtrar por prioridad (Critical/High primero)
- [ ] Activar listeners faltantes para eventos Critical: PAYMENT_FAILED, SYSTEM_ERROR
- [ ] Activar listeners faltantes para eventos High: LOW_STOCK, SEAT_LIMIT_REACHED, MAINTENANCE_ALERT
- [ ] Tests unitarios para cada listener activado

### HelpPage Backend
- [ ] Crear tabla `support_tickets` (id, company_id, user_id, subject, message, status, created_at)
- [ ] Endpoint POST `/api/support/tickets` con validación y RLS
- [ ] Email de confirmación al usuario (usar template básico)
- [ ] Notificación a admin de BETO OS (email o Slack webhook)

### Criterios de Aceptación Fase 0-A
- [ ] Evento PAYMENT_FAILED genera notificación in-app + email en <30s
- [ ] Formulario de HelpPage crea ticket visible en admin panel
- [ ] Todos los eventos Critical/High tienen listener activo y testeado

================================================================

📋 CHECKLIST IMPLEMENTACIÓN FASE 0-B (Foundation de Contenido)
================================================================

## Fase 0-B - Foundation de Contenido (2 semanas)

### Template System
- [ ] Crear tabla `notification_templates` (id, name, version, channel, content, variables_schema, is_active)
- [ ] Función `renderTemplate(templateId, variables)` con validación de schema
- [ ] UI mínima en PlatformAdmin para listar/editar templates (solo super-admin)
- [ ] Migrar 3 templates críticos: payment_failed, invoice_ready, maintenance_alert

### Event Bus — TTL
- [ ] Agregar campo `ttl_hours` INTEGER DEFAULT 72 a tabla events
- [ ] Job diario para archivar eventos expirados (o usar TTL nativo de Supabase)

### Preferencias — Canales
- [ ] Expandir `notification_preferences` con columnas: email_enabled, whatsapp_enabled (ambas BOOLEAN DEFAULT false)
- [ ] UI de preferencias en Settings page con explicación clara de cada canal
- [ ] Default: critical=true para todos, medium/low=false para WhatsApp

### Criterios de Aceptación Fase 0-B
- [ ] Template payment_failed renderiza correctamente con variables dinámicas
- [ ] Usuario puede desactivar email para eventos no-críticos
- [ ] Eventos con ttl expirado no generan notificaciones nuevas

================================================================

💡 MEJORAS CLAVE VS VERSIÓN 1.1
================================================================

1. PRIORIZACIÓN DE EVENTOS → No todas las notificaciones son iguales (critical/high/medium/low)
2. FASE 0 DIVIDIDA → "Operativa" + "Contenido" para evitar sobrecarga y asegurar entregas
3. WHATSAPP OUTBOUND LIMITADO → Solo crítico/billing/onboarding para controlar costos y desgaste
4. ACTION COMPLETION RATE → Medimos si el mensaje logró mover una decisión, no solo si se abrió
5. ESQUEMA DE COMENTARIOS SÓLIDO → Estructura definida desde el inicio (status, parent_id preparado)
6. POSTHOG CON CAUTELA → Decisión a validar según capacidad operativa real del equipo
7. GUARDRAIL CANAL 2 EXPLÍCITO → "Anuncios, tareas, alertas — NO chat libre"
8. GOBERNANZA EXPANDIDA → GDPR, retención, aprobación dual, rate limiting

================================================================

⚠️ RIESGOS IDENTIFICADOS
================================================================

| Riesgo                    | Probabilidad | Impacto | Mitigación                  |
|---------------------------|--------------|---------|-----------------------------|
| WhatsApp API rejection    | Media        | Alto    | Fallback a email + validar template antes de submit |
| Notification fatigue      | Alta         | Medio   | Rate limiting + preferences + digest diario |
| Email deliverability      | Media        | Alto    | Warm-up progresivo + SPF/DKIM + monitoreo |
| Comment spam/abuse        | Baja         | Medio   | Moderation + report system + solo miembros activos |
| Cost overrun (WhatsApp)   | Media        | Bajo    | Hard cap mensual + alertas de usage + solo crítico |
| Sobrecarga Fase 0         | Alta         | Alto    | División en 0-A + 0-B + criterios de salida claros |
| Canal 2 deriva a chat     | Media        | Medio   | Guardrail explícito + UI que no invite a conversación |

================================================================

📄 METADATOS DEL DOCUMENTO
================================================================

Documento: communication_strategy_v2.1.md
Versión: 2.1 (ajustes post-auditoría)
Autor: Equipo BETO OS
Última actualización: Marzo 2026
Próxima revisión: Junio 2026
Estado: ✅ APROBADO PARA EJECUCIÓN

Cambios vs v2.0:
• Fase 0 dividida en 0-A (operativa) + 0-B (contenido)
• Guardrail explícito para Canal 2: "no chat libre"
• WhatsApp outbound limitado a crítico/billing/onboarding
• Nuevo KPI: Action Completion Rate (>50% target)
• Schema de comentarios definido con status + parent_id futuro
• PostHog self-hosted marcado como decisión a validar
• Criterios de aceptación agregados por fase

================================================================

🎯 VEREDICTO FINAL (Post-Ajustes)
================================================================

✅ La versión 2.1 está lista para ejecutar porque:

FORTALEZAS CONSOLIDADAS:
• Comentarios contextuales con schema sólido desde el inicio
• Priorización por evento (critical/high/medium/low) operativa
• Gobernanza clara con 9 reglas + enforcement definido
• Roadmap realista con fases divididas y criterios de salida

RIESGOS MITIGADOS:
• Fase 0 dividida para evitar "empezar seis cosas, cerrar pocas"
• Canal 2 protegido con guardrail explícito contra chat libre
• WhatsApp outbound con disciplina estricta de uso
• Métrica de acción (no solo apertura) para validar impacto

PRÓXIMO PASO:
Iniciar Fase 0-A con equipo asignado y cronograma bloqueado.
Revisión de avance: 2 semanas (criterios de aceptación).

================================================================