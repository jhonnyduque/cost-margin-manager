/**
 * BETO OS — Email Service
 * Encargado de la lógica de envío de correos electrónicos.
 * Soporta Mock Mode para desarrollo y redirección de prueba.
 */
import { emailTemplates } from './emailTemplates';
import { communicationConfig } from '@/config/communication.config';
import { supabase } from './supabase';

export const emailService = {
    /**
     * Despacha un correo electrónico.
     * - Si useProvider=true y testMode=false, llama a la Edge Function `send-email`.
     * - Si testMode=true, usa mock (o forceError para simular fallo).
     */
    async sendEmail(options: { 
        to: string, 
        template: 'INVENTORY' | 'CRITICAL', 
        data: any,
        forceError?: boolean,
        useProvider?: boolean,
        compiled?: { subject: string; html: string; text?: string }
    }) {
        const target = communicationConfig.email.testMode ? communicationConfig.email.testTo : options.to;
        const timeoutMs = communicationConfig.email.timeoutMs || 7000;
        
        // 1. Obtener contenido de la plantilla (o usar precompilado)
        const content = options.compiled
            ? options.compiled
            : options.template === 'CRITICAL'
                ? emailTemplates.getSystemCritical(options.data)
                : emailTemplates.getInventoryAlert(options.data);

        // 2. Trazabilidad de intento
        console.log(`[EmailService] Intento de envío a: ${target}${communicationConfig.email.testMode ? ` (redirigido desde ${options.to})` : ''}`);
        console.log(`[EmailService] Asunto: ${content.subject}`);

        // Validación mínima de payload
        if (!content?.subject || !content?.html) {
            return Promise.reject({ success: false, error: 'Email payload incompleto (subject/html requerido)', error_type: 'permanent' });
        }

        // 3. Mock Mode o Provider real
        if (communicationConfig.email.testMode || !options.useProvider) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (options.forceError) {
                        const err = { success: false, error: 'Forced mock error', messageId: null, error_type: 'permanent' };
                        console.error('[EmailService][ERROR] Error simulado de envío.', err);
                        reject(err);
                        return;
                    }
                    const result = { success: true, messageId: `mock_${Date.now()}`, providerResponse: { target, mode: 'mock' } };
                    console.log(`[EmailService][SUCCESS] Entrega simulada realizada correctamente.`);
                    resolve(result);
                }, 600);
            });
        }

        // 4. Llamada a Edge Function real (Supabase) con timeout configurable
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);

            const { data, error, status } = await supabase.functions.invoke('send-email', {
                body: {
                    to: target,
                    subject: content.subject,
                    html: content.html,
                    text: content.text
                },
                signal: controller.signal as any
            });

            clearTimeout(timeout);

            if (error || !data?.success) {
                const errPayload = {
                    success: false,
                    error: (data && (data.error || data.message)) || error?.message || 'Email provider error',
                    providerResponse: data?.providerResponse || data || error || null,
                    status,
                    error_type: status && status >= 500 ? 'transient' : 'permanent'
                };
                throw errPayload;
            }

            return {
                success: true,
                messageId: data?.messageId || data?.providerResponse?.messageId || null,
                providerResponse: data?.providerResponse || data
            };
        } catch (err: any) {
            const normalized = typeof err === 'string' ? { error: err } : err;
            const error_type =
                normalized?.name === 'AbortError' ? 'transient' :
                normalized?.status && normalized.status >= 500 ? 'transient' : 'permanent';

            console.error('[EmailService][ERROR] Error de provider:', normalized);
            return Promise.reject({ success: false, ...normalized, error_type });
        }
    }
};
