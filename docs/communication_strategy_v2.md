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

DOCUMENTACIÖN
================================================================

Fase 0 — Foundation (Cerrada)
- Alcance: Event Bus inicial, esquema de eventos (events.ts), notificaciones in-app básicas, guardrails de canales, criterios de aceptación por prioridad.
- Evidencias clave: events.ts, notificationService.ts (creación básica), notificationListener.ts (arranque), governance de comunicación en este documento.
- Estado: Cerrada. No se requieren acciones salvo dependencias futuras de Fase 2.

Fase 1 — Presencia (Cerrada 28/03/2026)
- Subfases cubiertas:
  - 1-A Presencia inmediata: canal de soporte visible y operativo en Sidebar (WhatsApp link contextual).
  - 1-B Notification Center UI: tabs Todas/No leídas, agrupación por fecha, empty states diferenciados, deep-link/highlight, filtro temporal (30/90/YTD/12m/Todo).
  - 1-C / 1-C.2 Preferencias: lectura/escritura real, feedback de guardado, disponibilidad de canal en UI, caché con invalidación, bypass crítico activo.
  - 1-D Motor de filtrado inteligente: shouldNotify con cache y bypass crítico; listener con filtro por preferencia; aislamiento de scope user/company/global en fetch, badge, mark-all y realtime.
- Política de scope vigente:
  - user-scoped → user_id del usuario autenticado
  - company-scoped → company_id de la empresa actual del usuario
  - global-scoped → target_scope = 'global'
- Deuda menor (no bloqueante): robustecer configuración/fallback del canal de soporte (1-A) si no hay número/WA disponible.
- Estado: Cerrada. Bloqueante de scope resuelto en getNotifications, getUnreadCount, markAllAsRead y subscribeToNotifications.

Fase 2 — Valor Operativo (Cerrada 29/03/2026)
- Subfases cubiertas:
  - 2-A Email Engine: Edge Function `send-email` (Supabase) con Brevo; secrets backend (`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`); testMode=true → mock; testMode=false → envío real vía provider; sender sin fallbacks; payload validado (`to`, `subject`, `html`); delivery_logs distinguen mock vs provider.
  - 2-B WhatsApp Gateway: servicio en modo controlado; sin hardcodes ni fallbacks; testMode con `testPhone` obligatorio (fail-fast si falta); elegible solo para crítico/billing; logging de success/omitted/error/unresolved; sin proveedor real (decisión de alcance).
  - 2-C Auditoría/Hardening/Observabilidad: config centralizada en `communication.config.ts`; `.env.example` sin secrets reales; logging estructurado (status, destination, error_message, provider_response); UI de auditoría en PlatformAdmin (super-admin).
- Validación operativa:
  - Email real entregado y visible en Brevo Logs; recepción confirmada en Gmail; firma de dominio válida.
  - `notificationService` invoca `send-email` con payload correcto; errores del provider se registran con detalle.
  - WhatsApp en mock controlado; delivery_logs coherentes.
- Estado: Cerrada. No hay bloqueantes dentro del alcance definido para Fase 2; WA productivo y retries/colas quedan explícitamente para fases posteriores.

Fase 3-A — Madurez Operativa (Cerrada 30/03/2026)
- Bloques ejecutados:
  - Generador unificado por eventKey (subject/html/text y waText), validación de plantillas y guardado en metadata para reintentos manuales.
  - Clasificación de errores de email (transient/permanent) y persistencia en delivery_logs con `error_type` e indicador mock/real.
  - Observabilidad UI: muestra error_type, mock vs real, provider_response/metadata expandible, filtro por evento.
  - Reintento manual básico: solo email, solo errores transient con metadata compilada, invocando `send-email`.
  - WhatsApp auxiliar manual: link `wa.me` en UI (sin automatizar ni integrar proveedor).
- Validación:
  - Email productivo intacto; reintentos manuales ejecutan la misma función `send-email`.
  - UI de auditoría mantiene filtros previos y agrega detalle sin romper flujo.
- Exclusiones explícitas (fase futura): WhatsApp productivo, retries automáticos/colas, multi-proveedor, dashboards avanzados.

Runbook operativo (pendiente de redacción breve)
- Responder “qué hacer si…”:
  - Error transient (Brevo 5xx / timeout): reintento manual desde UI; si persiste, verificar estado de Brevo y secretos.
  - Error permanent (4xx / email inválido): corregir destino o payload y reenviar.
  - Falta de secrets: cargar en Supabase secrets y redeploy de función.
  - Plantilla incompleta: revisar compilación por eventKey y completar subject/html.
- Añadir en UI (opcional y liviano): aviso al reintentar si falta compiledEmail o destino (=unresolved).
Fase 3 — Estabilización Operativa (Cerrada 31/03/2026)
- Subfases cubiertas:
  - 3-A Madurez Operativa: generador unificado por eventKey (email/WA), error_type transient/permanent en delivery_logs, observabilidad UI con provider_response/metadata y filtro por evento, retry manual de email solo transient, WA auxiliar manual via wa.me.
  - 3-A.1 Corrección Semántica: WA mock marcado como status=omitted + is_mock=true + provider_response.mock=true para eliminar falsos éxitos.
  - 3-B.0 Preparación Operativa: runbook mínimo (toggles test/prod, claves Brevo, manejo de fallas email/WA mock, escalado), timeout configurable en email, clasificación uniforme de error_type, guardrails de retry manual.
  - 3-B Estabilización: unificación de helpers de contenido en notificationService; validación ligera de payload email (subject/html) antes del provider; observabilidad mínima añadida (filtros mock/real y búsqueda en DeliveryLogs); copy de PlatformAdmin aclarando WA mock/manual; runbook ampliado con notas de operación diaria.
- Estado operativo final:
  - Email productivo Brevo con timeout configurable, error_type consistente, retry manual acotado; payload básico validado.
  - WhatsApp se mantiene solo mock/manual (status=omitted, is_mock=true, wa.me); sin riesgo de falsos “Entregado”.
  - Logging/observabilidad: delivery_logs con provider_response/metadata/error_type/is_mock; UI con filtros canal/estado/evento/mock-real + búsqueda.
  - Soporte: runbook vigente cubre toggles, claves, fallas comunes y criterio de reintento manual.
- Deuda menor (no bloqueante): falta filtro por empresa/tenant en DeliveryLogs para multi-tenant complejo; validación extra en Edge Function ante llamadas externas podría reforzarse.
- Exclusiones explícitas: WA productivo/multi-provider, retries automáticos/colas/backoff, analytics avanzados/premium.
- Estado: Cerrada. Validación externa independiente: “Fase 3 puede considerarse cerrada a nivel productivo”.
Fase 4-A.0 — Gobernanza y contrato operativo de WhatsApp productivo (Pendiente de provider, Cerrada en diseño)
- Fuente de verdad de activación:
  - Flags en communication.config.ts / env: VITE_COMM_WHATSAPP_ENABLED, VITE_COMM_WHATSAPP_TEST_MODE, VITE_COMM_WHATSAPP_MANUAL_ONLY (default true), VITE_COMM_WHATSAPP_PROVIDER_ENABLED (default false).
  - Caps/env: VITE_COMM_WHATSAPP_DAILY_CAP_PER_USER (default 3), VITE_COMM_WHATSAPP_COOLDOWN_CRITICAL_MIN (default 120), whitelist eventos VITE_COMM_WHATSAPP_WHITELIST_EVENTS (default SYSTEM_CRITICAL,BILLING_PAYMENT_FAILED).
  - La decisión efectiva vive en backend/config, no en frontend.
- Permisos y responsabilidades:
  - Habilitar provider/caps/whitelist: solo ops/owner mediante env/secrets (deployment).
  - Disparar eventos elegibles: solo super-admin/servicio interno; usuarios regulares no pueden forzar WA.
  - Revocar opt-in: soporte/ops via registro de opt-in (tabla whatsapp_optin) anulando revoked_at.
- Opt-in mínimo (a crear en DB antes de encender provider): tabla whatsapp_optin {user_id, phone_e164, consent_at, revoked_at}. Envío solo si consent_at existe y revoked_at es null.
- Caps y cómputo:
  - Cuenta si status in (success,error) con is_mock=false. Omitted por regla no consume cupo.
  - Ventana diaria por user: dailyCapPerUser (default 3). Cooldown para eventos críticos: cooldownCriticalMinutes (default 120) por user/event.
- Whitelist de eventos productivos:
  - SYSTEM_CRITICAL
  - BILLING_PAYMENT_FAILED
  (ningún otro eventKey puede usar WA productivo).
- Contrato de logging:
  - En modo provider: channel=whatsapp, is_mock=false, status según provider; error_type: 4xx→permanent, 5xx/timeout→transient; si se omite por regla, status=omitted y metadata._meta.reason ∈ {no_opt_in, cap_exceeded, event_not_whitelisted, manual_only, test_mode}.
  - En mock/manual: is_mock=true; las acciones manuales via wa.me no registran “success” automático ni provider_response; se registran como omitted/mock o acción manual fuera del flujo automático.
- Alcance de esta subfase:
  - Sin integración de provider aún. Solo contrato y configuración para gobernanza previa al encendido productivo.
  - Fase 3 no se altera; WA sigue mock/manual hasta activar provider flag.
- Estado: Cierre de gobernanza/documento completado; integración provider queda para 4-A.x.

Fase 4 — Expansión controlada de canales y visibilidad (Abierta)
- Objetivo: habilitar capacidades premium/controladas sin perder gobernanza: WA productivo acotado, KPIs operativos y onboarding mínimo seguro.
- Subfases previstas:
  - 4-A.0 Gobernanza WA (cerrada en diseño, provider aún apagado)
  - 4-A.x Integración provider WA bajo contrato (pendiente)
  - 4-B KPIs/analytics operativos ligeros (pendiente)
  - 4-C Onboarding mínimo con guardrails (pendiente)
- Estado actual: fase madre abierta; solo 4-A.0 cerrada.
- Alcance cerrado: contrato de gobernanza WA (flags, opt-in, caps, whitelist, logging); sin envío productivo todavía.
- Pendiente: encendido provider WA conforme al contrato; KPIs ligeros; onboarding mínimo; filtro tenant en DeliveryLogs.
Fase 4-A.1 — Enforcement backend del contrato WA (Cerrada)
- Objetivo: aplicar efectivamente en runtime el contrato definido en 4-A.0 antes de integrar provider real.
- Cambios aplicados:
  - enforcement de flags providerEnabled/manualOnly/testMode
  - permisos backend para WA productivo
  - verificación de opt-in
  - validación de phone_e164
  - caps por usuario/evento
  - whitelist estricta de eventKey
  - omitted con reason clara ante cualquier bloqueo
  - provider_not_implemented registrado como omitted + is_mock=true mientras no exista provider real
- Estado final: COMPLETADA
Fase 4-A.x — Integración real del provider WA (Cerrada)
- Objetivo: habilitar envío WhatsApp productivo usando el contrato 4-A.0/4-A.1 sin colas ni retries automáticos.
- Cambios aplicados: whatsappService invoca provider (Meta Cloud API) con timeout; notificationService mantiene enforcement (flags, permisos, opt-in, caps, whitelist) y registra status/error_type/is_mock; rutas mock/manual intactas.
 - Estado final: COMPLETADA.
## Nota de higiene de line endings (31-Mar-2026)
- Se observaban warnings de Git en Windows ("LF will be replaced by CRLF") con `core.autocrlf=true`.
- Se fijó la política del repo en `.gitattributes` (LF por defecto; PS1 en CRLF) y se cambió `core.autocrlf` global a `input` para evitar conversiones al commitear desde Windows.
- Objetivo: reducir ruido en commits y mantener consistencia explícita por tipo de archivo.
- No fue necesario renormalizar archivos en esta iteración; si aparecen diferencias, ejecutar `git add --renormalize .` tras aplicar las reglas.
- Estado final: COMPLETADA.
Fase 4-A.x — Integración saliente con provider WA (Cerrada)
- Qué quedó cerrado: salida real desde BETO OS al provider Meta (token válido, phone_number_id correcto), autenticación OK, request real con is_mock=false, provider_response con contacts/messages/message_id, UI muestra “Aceptado por provider” (no “Entregado”).
- Qué no quedó cerrado: no hay confirmación de recepción en dispositivo; sin webhooks de estados (delivery/read) no se afirma entrega extremo a extremo.

Fase 4-A.y — Validación de recepción real en dispositivo (Pendiente)
- Verificar recepción visible en WhatsApp real bajo reglas de plantilla/conversación.
- Sin webhook de estados no se debe afirmar delivery/read; requiere validación manual o inbound futuro.
- Mantener lenguaje prudente hasta confirmar delivery/read.

Fase 5 — Refinamiento operativo (Cerrada)
- Objetivo: expansión controlada sobre base estable, con visibilidad y reacción rápidas sin añadir complejidad.
- Sub-bloques:
  - 5-B Alertas operativas mínimas: detección por umbral (error rate, config, consecutivos), alert_type y runbook_hint en metadata, cooldown para evitar ruido.
  - 5-C Reporting operativo corto: KPIs por rango (24h/7d/30d), breakdown por canal/mock-real, top eventos, top razones error/omitted, conteo de alertas.
  - 5-D Soporte/diagnóstico refinado: razones legibles, hints de runbook visibles, mensajes prescriptivos (“token inválido → revisar configuración”), priorización visual ligera.
- Estado final: COMPLETADA.
Fase 4-A — WhatsApp productivo controlado (Cerrada)
- Objetivo: habilitar WhatsApp productivo real desde BETO OS con gobernanza y control.
- Implementado: integración real con Meta Cloud API; token estable de system user; phone_number_id y WABA correctos; enforcement de flags/permisos/opt-in/caps/whitelist; logging real en delivery_logs; UI semántica corregida ("Aceptado por provider").
- Validado en runtime: request real al provider; provider_response con message id; is_mock=false; recepción visible en dispositivo final; confirmación de que la ventana de 24h afecta la entrega de mensajes libres.
- Aprendizaje operativo: sin conversación abierta, Meta puede aceptar a nivel provider pero no garantiza visibilidad final del mensaje libre; fuera de ventana se requiere plantilla/estrategia adecuada.
- Observación de cierre real: el envío saliente y la recepción visible en dispositivo quedaron validados. El webhook de estados de WhatsApp no quedó cerrado por una restricción externa de Meta: mientras la app permanezca sin publicar, Meta solo envía webhooks de prueba desde el panel y no entrega callbacks de producción al endpoint configurado, aunque el campo `messages` esté suscrito y el callback/verify token sean correctos.
- Implicación operativa: BETO OS puede operar WhatsApp real controlado para destinatarios explícitos y validar entrega visible manualmente; la trazabilidad automática `sent/delivered/read` en `delivery_logs` queda supeditada a publicar la app o completar el estado productivo exigido por Meta.
- Fuera de alcance: webhooks inbound y estados delivered/read productivos hasta que Meta habilite datos de producción; analytics avanzados; onboarding; multi-provider.
- Estado final: Fase 4-A COMPLETADA.
Fase 4-C — UX operativa y prevención de error humano (Cerrada)
- Objetivo: reducir errores humanos y guiar uso seguro de canales (especialmente WhatsApp) mediante guardrails UI y ayuda operativa mínima.
- Cambios aplicados:
  - PlatformAdmin: checklist breve para WA productivo (token/config, número E.164 + opt-in, ventana 24h, eventos elegibles, “Aceptado por provider ≠ leído”).
  - BroadcastConsole: validación UI de título obligatorio para críticos; mensajes de estatus más claros.
  - Helper texts: avisos previos en UI sobre restricciones (ventana 24h, opt-in, elegibilidad de eventos) y semántica ajustada de éxito.
  - Runbook: sección de diagnóstico rápido (token, ventana 24h, no_opt_in, caps, provider/test/manual, phone ausente, “Aceptado por provider” no garantiza lectura).
- Alcance real 4-C: guardrails/pre-validaciones, ayuda visible, checklist técnico corto; evitar confusión sobre estados y restricciones del canal.
- Ajustes complementarios (no redefinen 4-C): filtros/rangos/KPIs ligeros de DeliveryLogs pertenecen a 4-B (observabilidad), aunque se tocaron en la misma iteración.
- Frontera 4-B vs 4-C: 4-B = observabilidad/KPIs ligeros sobre delivery_logs; 4-C = UX operativa y prevención de error humano (copys, checklist, validaciones UI mínimas).
- Estado operativo: operador ve checklist, recibe alertas previas, entiende que “Aceptado por provider” no es lectura, y cuenta con runbook breve para causas comunes.
- Estado final: COMPLETADA.
