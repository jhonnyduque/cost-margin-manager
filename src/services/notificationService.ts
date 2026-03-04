import { supabase } from './supabase';
import { EventKey } from '../core/events';

export type NotificationLevel = 'info' | 'warning' | 'error';
export type NotificationScope = 'user' | 'company' | 'global';

export interface CreateNotificationDto {
    userId?: string | null;
    companyId?: string | null;
    eventKey: EventKey;
    targetScope: NotificationScope;
    level: NotificationLevel;
    title: string;
    message: string;
    actionUrl?: string | null;
    data?: any;
}

export const notificationService = {
    /**
     * Crea una notificación en el sistema.
     * Esta función suele ser llamada por el NotificationListener.
     */
    async createNotification(dto: CreateNotificationDto) {
        const { error } = await supabase.from('notifications').insert({
            user_id: dto.userId,
            company_id: dto.companyId,
            event_key: dto.eventKey,
            target_scope: dto.targetScope,
            level: dto.level,
            title: dto.title,
            message: dto.message,
            action_url: dto.actionUrl,
            data: dto.data || {}
        });

        if (error) {
            console.error('[NotificationService] Error creating notification:', error);
            throw error;
        }

        return true;
    },

    /**
     * Obtiene las notificaciones cargadas para el usuario actual.
     */
    async getNotifications(limit = 20) {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    },

    /**
     * Obtiene el conteo de no leídas para el badge.
     */
    async getUnreadCount() {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .is('read_at', null);

        if (error) throw error;
        return count || 0;
    },

    /**
     * Marca una notificación como leída.
     */
    async markAsRead(id: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
        return true;
    },

    /**
     * Marca todas como leídas.
     */
    async markAllAsRead() {
        const { error } = await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .is('read_at', null);

        if (error) throw error;
        return true;
    },

    /**
     * Suscripción en tiempo real a nuevas notificaciones.
     */
    subscribeToNotifications(callback: (payload: any) => void) {
        return supabase
            .channel('notifications_realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications'
                },
                (payload) => callback(payload.new)
            )
            .subscribe();
    }
};
