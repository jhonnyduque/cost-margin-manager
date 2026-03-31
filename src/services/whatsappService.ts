/**
 * BETO OS — WhatsApp Service
 * Lógica de despacho de mensajes vía WhatsApp.
 * Esta capa es delgada: solo invoca el provider (o mock si testMode).
 */
import { whatsappTemplates } from './whatsappTemplates';
import { communicationConfig } from '@/config/communication.config';

const PROVIDER_TIMEOUT_MS = 7000;
// Los secretos se leen desde communication.config (inyectados vía env VITE_COMM_WHATSAPP_* / VITE_WHATSAPP_*)

export const whatsappService = {
    /**
     * Envía un mensaje de WhatsApp con plantilla fija.
     * - No acepta texto libre; solo templates definidas.
     */
    async sendWhatsApp(options: { 
        to: string, 
        template: 'INVENTORY' | 'BILLING' | 'CRITICAL',
        data: any 
    }) {
        const cfg = communicationConfig.whatsapp;
        const phoneNumberId = cfg.phoneNumberId?.trim();
        const isDev = (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) ?? false;

        // Mock/test mode
        if (cfg.testMode || cfg.manualOnly || !cfg.providerEnabled) {
            return { success: false, mock: true, omitted: true, reason: 'provider_disabled_or_test', messageId: null };
        }

        // 1. Generar contenido (sin texto libre)
        let content;
        if (options.template === 'CRITICAL') {
            content = whatsappTemplates.getSystemCritical(options.data);
        } else if (options.template === 'BILLING') {
            content = whatsappTemplates.getBillingAlert(options.data);
        } else {
            content = whatsappTemplates.getInventoryCritical(options.data);
        }
        const text = content?.text || 'Mensaje BETO OS';

        // 2. Llamada al provider (Meta Cloud API)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

        const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
        if (isDev) {
            console.info('[WA][dev] phoneNumberId:', phoneNumberId || '(empty)', 'endpoint:', url);
        }
        const body = {
            messaging_product: 'whatsapp',
            to: options.to,
            type: 'text',
            text: { body: text }
        };

        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cfg.apiKey}`
                },
                body: JSON.stringify(body),
                signal: controller.signal as any
            });
            clearTimeout(timeout);

            const providerResponse = await resp.json().catch(() => ({}));
            const success = resp.ok;
            const error_type = success ? null : (resp.status >= 500 ? 'transient' : 'permanent');

            return {
                success,
                messageId: providerResponse?.messages?.[0]?.id || null,
                providerResponse,
                error_type,
                status: resp.status
            };
        } catch (err: any) {
            clearTimeout(timeout);
            const isAbort = err?.name === 'AbortError';
            return {
                success: false,
                messageId: null,
                providerResponse: { error: err?.message || 'WA provider error' },
                error_type: isAbort ? 'transient' : 'permanent',
                status: isAbort ? 408 : null
            };
        }
    }
};
