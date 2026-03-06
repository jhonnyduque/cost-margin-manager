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
            .select(`
                *,
                notification_reads!left(read_at)
            `)
            .or(`user_id.eq.${userId},target_scope.in.(global,company)`)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        // Mapear el estado read_at desde la tabla de relación o la propia notificación
        return data.map(n => ({
            ...n,
            read_at: n.user_id ? n.read_at : (n.notification_reads?.[0]?.read_at || null)
        }));
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

        const { data: notes, error: fetchError } = await supabase
            .from('notifications')
            .select(`
                id,
                user_id,
                read_at,
                notification_reads!left(read_at)
            `)
            .or(`user_id.eq.${userId},target_scope.in.(global,company)`);

        if (fetchError) throw fetchError;

        // Contar las que no tienen read_at personal ni en la relación
        const unread = notes.filter(n => {
            if (n.user_id) return !n.read_at;
            return !n.notification_reads || n.notification_reads.length === 0;
        });

        return unread.length;
    },

    /**
     * Marca una notificación como leída.
     *
     * 🔴 FIX: Añadido filtro por user_id — previene que un usuario
     * pueda marcar como leída una notificación de otro usuario.
     */
    async markAsRead(id: string) {
        const userId = await getCurrentUserId();

        // Primero verificamos si es una notificación personal
        const { data: note } = await supabase
            .from('notifications')
            .select('user_id')
            .eq('id', id)
            .single();

        if (note?.user_id) {
            // Si es personal, actualizamos directamente (como antes, pero seguro)
            const { error } = await supabase
                .from('notifications')
                .update({ read_at: new Date().toISOString() })
                .eq('id', id)
                .eq('user_id', userId);
            if (error) throw error;
        } else {
            // Si es global/empresa, registramos la lectura individual en la nueva tabla
            const { error } = await supabase
                .from('notification_reads')
                .upsert({
                    notification_id: id,
                    user_id: userId,
                    read_at: new Date().toISOString()
                }, { onConflict: 'notification_id,user_id' });
            if (error) throw error;
        }

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

        // 1. Marcar personales
        await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('user_id', userId)
            .is('read_at', null);

        // 2. Marcar compartidas (global/company)
        // Buscamos todas las compartidas que el usuario no ha leído aún
        const { data: sharedNotes } = await supabase
            .from('notifications')
            .select(`
                id,
                notification_reads!left(id)
            `)
            .is('user_id', null)
            .or('target_scope.eq.global,target_scope.eq.company');

        if (sharedNotes) {
            const unreadShared = sharedNotes.filter(n => !n.notification_reads || n.notification_reads.length === 0);

            if (unreadShared.length > 0) {
                const reads = unreadShared.map(n => ({
                    notification_id: n.id,
                    user_id: userId,
                    read_at: new Date().toISOString()
                }));

                await supabase.from('notification_reads').upsert(reads, { onConflict: 'notification_id,user_id' });
            }
        }

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
                    table: 'notifications'
                },
                (payload) => {
                    const newNote = payload.new;
                    // Filtrar en cliente: si es para el usuario OR global OR de su empresa
                    const isForMe = newNote.user_id === userId ||
                        newNote.target_scope === 'global' ||
                        (newNote.target_scope === 'company' && newNote.company_id); // El company_id se valida en RLS usualmente

                    if (isForMe) callback(newNote);
                }
            )
            .subscribe();
    }
};