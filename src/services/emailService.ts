/**
 * BETO OS — Email Service
 * Encargado de la lógica de envío de correos electrónicos.
 * Soporta Mock Mode para desarrollo y redirección de prueba.
 */
import { emailTemplates } from './emailTemplates';

// ENTORNO DE PRUEBA (Fase 2-A)
const TEST_EMAIL = 'jhonnydp78@gmail.com';
const IS_TEST_MODE = true; // Activa la redirección al correo de Beto

export const emailService = {
    /**
     * Despacha un correo electrónico.
     */
    async sendEmail(options: { 
        to: string, 
        template: 'INVENTORY' | 'CRITICAL', 
        data: any 
    }) {
        const target = IS_TEST_MODE ? TEST_EMAIL : options.to;
        
        // 1. Obtener contenido de la plantilla
        let content;
        if (options.template === 'CRITICAL') {
            content = emailTemplates.getSystemCritical(options.data);
        } else {
            content = emailTemplates.getInventoryAlert(options.data);
        }

        // 2. Trazabilidad de intento
        console.log(`[EmailService] Intento de envío a: ${options.to}${IS_TEST_MODE ? ` (Redirigido a ${TEST_EMAIL})` : ''}`);
        console.log(`[EmailService] Asunto: ${content.subject}`);

        // 3. Mock Mode (Fase 2-A) - Simula el envío asíncrono
        return new Promise((resolve) => {
            setTimeout(() => {
                // Registro de éxito simulado
                console.log(`[EmailService][SUCCESS] Entrega simulada realizada correctamente.`);
                resolve({ success: true, messageId: `mock_${Date.now()}` });
            }, 800);
        });
    }
};
