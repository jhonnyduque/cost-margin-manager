import { supabase } from '../supabase';
import { EVENTS } from '../../core/events';
import { notificationService } from '../notificationService';

export const notificationListener = {
    /**
     * Inicializa la escucha del Event Bus para generar notificaciones.
     * En una app frontend, esto suele llamarse una vez al inicio.
     */
    start() {
        // Listener inicializado silenciosamente

        return supabase
            .channel('event_bus_notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'event_bus'
                },
                async (payload) => {
                    await this.handleEvent(payload.new);
                }
            )
            .subscribe();
    },

    /**
     * Procesa un evento del bus y decide si genera una notificación.
     */
    async handleEvent(event: any) {
        const { event_key, company_id, user_id, payload } = event;

        switch (event_key) {
            case EVENTS.INVENTORY_LOW_STOCK:
                await notificationService.createNotification({
                    companyId: company_id,
                    eventKey: event_key,
                    targetScope: 'company',
                    level: 'warning',
                    title: 'Stock Bajo Detectado',
                    message: `El producto ${payload.productName || 'desconocido'} ha caído por debajo del umbral mínimo.`,
                    actionUrl: '/inventory',
                    data: payload
                });
                break;

            case EVENTS.BILLING_PAYMENT_FAILED:
                await notificationService.createNotification({
                    companyId: company_id,
                    eventKey: event_key,
                    targetScope: 'company',
                    level: 'error',
                    title: 'Error en Pago',
                    message: 'No pudimos procesar tu último pago. Revisa tu cuenta de facturación.',
                    actionUrl: '/settings/billing',
                    data: payload
                });
                break;

            case EVENTS.TEAM_USER_INVITED:
                await notificationService.createNotification({
                    userId: user_id, // Al que invitó o al invitado? Usualmente al que invitó para confirmar.
                    companyId: company_id,
                    eventKey: event_key,
                    targetScope: 'user',
                    level: 'info',
                    title: 'Invitación Enviada',
                    message: `Has invitado a ${payload.email} a la empresa.`,
                    actionUrl: '/team',
                    data: payload
                });
                break;

            case EVENTS.SYSTEM_MAINTENANCE:
                await notificationService.createNotification({
                    eventKey: event_key,
                    targetScope: 'global',
                    level: 'info',
                    title: payload.title || 'Aviso BETO OS',
                    message: payload.message || 'El sistema entrará en mantenimiento pronto.',
                    data: payload
                });
                break;

            default:
                // Otros eventos pueden no requerir notificación in-app inmediata
                break;
        }
    }
};
