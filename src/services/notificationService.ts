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

/**
 * Helper interno — obtiene el user_id del usuario autenticado actualmente.
 * Lanza error si no hay sesión activa, lo que previene queries sin filtro
 * que expondrían notificaciones de otros usuarios.
 */
async function getCurrentUserId(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('[NotificationService] No active session');
    return user.id;
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
     * Obtiene las notificaciones del usuario actual.
     *
     * 🔴 FIX: Añadido filtro por user_id — antes traía todas las notificaciones
     * de la tabla sin filtrar, exponiendo datos de otros usuarios y causando
     * que el estado de lectura se mezclara entre sesiones.
     */
    async getNotifications(limit = 20) {
        const userId = await getCurrentUserId();

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    },

    /**
     * Obtiene el conteo de no leídas del usuario actual para el badge.
     *
     * 🔴 FIX: Añadido filtro por user_id — antes contaba todas las
     * read_at IS NULL globales, lo que causaba que al refrescar el badge
     * mostrara un número incorrecto (suma de todos los usuarios).
     */
    async getUnreadCount() {
        const userId = await getCurrentUserId();

        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .is('read_at', null);

        if (error) throw error;
        return count || 0;
    },

    /**
     * Marca una notificación como leída.
     *
     * 🔴 FIX: Añadido filtro por user_id — previene que un usuario
     * pueda marcar como leída una notificación de otro usuario.
     */
    async markAsRead(id: string) {
        const userId = await getCurrentUserId();

        const { error } = await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        return true;
    },

    /**
     * Marca todas las notificaciones del usuario actual como leídas.
     *
     * 🔴 FIX: Añadido filtro por user_id — antes actualizaba TODAS
     * las notificaciones sin leer de toda la tabla.
     */
    async markAllAsRead() {
        const userId = await getCurrentUserId();

        const { error } = await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('user_id', userId)
            .is('read_at', null);

        if (error) throw error;
        return true;
    },

    /**
     * Suscripción en tiempo real a nuevas notificaciones del usuario actual.
     *
     * 🔴 FIX: Añadido filtro user_id en el canal de realtime — antes
     * el callback se disparaba con INSERT de cualquier usuario,
     * incrementando el badge incorrectamente para todos.
     *
     * Nota: el canal se nombra con userId para que cada sesión tenga
     * su propio canal independiente y no haya colisiones entre usuarios.
     */
    subscribeToNotifications(userId: string, callback: (payload: any) => void) {
        return supabase
            .channel(`notifications_realtime_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => callback(payload.new)
            )
            .subscribe();
    }
};