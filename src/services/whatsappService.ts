/**
 * BETO OS — WhatsApp Service
 * Lógica de despacho de mensajes vía WhatsApp.
 * Canal restringido de alta prioridad / Fase 2-B.
 */
import { whatsappTemplates } from './whatsappTemplates';

// ENTORNO DE PRUEBA (Fase 2-B)
const TEST_PHONE = '+34604405615';
const IS_TEST_MODE = true;

export const whatsappService = {
    /**
     * Envía un mensaje de WhatsApp.
     */
    async sendWhatsApp(options: { 
        to: string, 
        template: 'INVENTORY' | 'BILLING' | 'CRITICAL',
        data: any 
    }) {
        const target = IS_TEST_MODE ? TEST_PHONE : options.to;

        // 1. Generar contenido
        let content;
        if (options.template === 'CRITICAL') {
            content = whatsappTemplates.getSystemCritical(options.data);
        } else if (options.template === 'BILLING') {
            content = whatsappTemplates.getBillingAlert(options.data);
        } else {
            content = whatsappTemplates.getInventoryCritical(options.data);
        }

        // 2. Mock Mode (Fase 2-B)
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({ success: true, messageId: `wa_mock_${Date.now()}` });
            }, 600);
        });
    }
};
