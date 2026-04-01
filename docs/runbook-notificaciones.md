## BETO OS — Runbook Operativo de Notificaciones (Email / WhatsApp controlado)

### 1) Toggles rápidos
- Email testMode: `VITE_COMM_EMAIL_TEST_MODE` (default true).  
- Email destino de prueba: `VITE_COMM_EMAIL_TEST_TO`.  
- WhatsApp testMode: `VITE_COMM_WHATSAPP_TEST_MODE` (default true).  
- WhatsApp testPhone: `VITE_COMM_WHATSAPP_TEST_PHONE`.  
- Para activar proveedor real: setear `VITE_COMM_EMAIL_ENABLED=true`, `VITE_COMM_EMAIL_TEST_MODE=false` y cargar claves Brevo (ver abajo). WhatsApp sigue deshabilitado (`VITE_COMM_WHATSAPP_ENABLED=false`) en esta fase.

### 2) Claves/Secrets requeridos (Email real - Brevo)
- `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` (Edge Function `send-email` y comunicación.config).  
- Ubicación: variables de entorno Supabase Edge Function y `.env.local` para Vite (no commitear prod).  

### 3) Manejo de fallas — Email
- Timeout configurable: `VITE_COMM_EMAIL_TIMEOUT_MS` (default 7000 ms).  
- Clasificación de errores:  
  - `transient`: timeouts, HTTP 5xx, AbortError.  
  - `permanent`: validación, 4xx, mock `forceError`.  
- Acción operativa:  
  - Reintento manual **solo** si el log muestra `error_type=transient` o timeout.  
  - No reintentar si `error_type=permanent` o si falta subject/html.  
  - Reintento manual usar “Reintentar” en Delivery Logs (email) o volver a emitir evento si aplica.

### 4) Manejo de fallas — WhatsApp (real controlado)
- El canal puede operar en real para destinatarios explícitos con opt-in y ventana de 24h vigente.
- Si no llega al dispositivo pero Meta acepta el envío: revisar primero ventana 24h, tipo de mensaje y opt-in.
- Si se ve error en log (destinatario no resuelto o provider error): corregir número/config y reemitir evento. No hay retry automático.

### 5) Ruta de escalado
- Nivel 1: Soporte interno — revisar `delivery_logs` y consola de funciones Supabase.
- Nivel 2: Dev responsable de notificaciones (owner: Plataforma).
- Nivel 3: Credenciales/proveedor — coordinar con Ops para rotar claves Brevo.

### 6) Guardrails de retry manual
- Solo ejecutar si: `error_type=transient` **o** timeout.  
- Máximo 1 reintento manual por incidente; si falla, escalar.  
- Registrar resultado en Delivery Logs (UI ya lo muestra al reintentar).

### 7) Verificación rápida post-cambio
- Confirmar `communicationConfig.email.testMode` según entorno.
- Enviar evento crítico -> verificar log email con `status` success/omitted y `error_type` correcto.
- Para WhatsApp real controlado: verificar que el mensaje llegue al dispositivo final cuando la ventana de 24h esté abierta.

### 8) Diagnóstico operativo rápido (Email / WhatsApp)
- Token expirado / inválido: status=error, error_type=permanent (4xx), provider_response con código; revisar env/token y reintentar.
- Ventana 24h (WA): provider puede aceptar pero el mensaje libre puede no mostrarse; usar plantilla o abrir conversación para reintentos posteriores.
- no_opt_in: status=omitted, reason=no_opt_in; registrar opt-in válido (tabla whatsapp_optin).
- cap_exceeded / cooldown: status=omitted, reason=cap_exceeded/cooldown_active; esperar ventana o ajustar caps si procede.
- provider disabled / manual_only / test_mode: status=omitted, reason=provider_disabled/manual_only/test_mode.
- Payload/phone ausente o inválido: status=omitted, reason=no_phone/invalid_phone.
- “Aceptado por provider” (WA success): indica aceptación por Meta, no garantiza lectura; sin webhook de estados no se afirma delivered/read.
- Meta webhook de producción no llega aunque `messages` esté suscrito: verificar estado de publicación de la app. Meta no entrega callbacks de producción mientras la app siga sin publicar; en ese estado solo se reciben webhooks de prueba desde el panel.

### 9) Diagnóstico en 10 segundos
1. Canal activo (enabled, no test/manual-only para envío real).  
2. Evento elegible (WA: SYSTEM_CRITICAL, BILLING_PAYMENT_FAILED).  
3. Opt-in y número E.164 presentes.  
4. Caps/ventana 24h (WA libres) vigentes.  
5. Token/config válidos; si error 4xx → permanent, 5xx/timeout → transient.

### 10) Nota observada en runtime — Meta WhatsApp
- Hallazgo confirmado: BETO OS ya entrega mensajes reales de WhatsApp en dispositivo final cuando la ventana de 24h está abierta.
- Pendiente externo: los estados productivos `sent/delivered/read` no ingresan a `webhooks-ingest` mientras la app de Meta permanezca sin publicar, aunque el callback URL, verify token y el campo `messages` estén correctamente configurados.
- Consecuencia: para WhatsApp real controlado, la evidencia operativa principal sigue siendo la recepción visible en el dispositivo hasta que Meta habilite callbacks de producción.
