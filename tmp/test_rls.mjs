
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

try {
    const env = fs.readFileSync('.env.local', 'utf8');
    const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
    const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

    if (!urlMatch || !keyMatch) {
        console.error('Missing credentials in .env.local');
        process.exit(1);
    }

    const supabaseUrl = urlMatch[1].trim().replace(/['"]/g, '');
    const supabaseAnonKey = keyMatch[1].trim().replace(/['"]/g, '');

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    async function testUpdate() {
        console.log('--- TEST DE ACTUALIZACIÓN RLS ---');

        // Buscamos una notificación sin user_id (global o empresa)
        const { data: note, error: fetchError } = await supabase
            .from('notifications')
            .select('id, title, user_id, target_scope')
            .is('read_at', null)
            .limit(1)
            .single();

        if (fetchError) {
            console.log('No se encontró ninguna notificación no leída para probar o error al buscar:', fetchError.message);
            return;
        }

        console.log(`Intentando marcar como leída: "${note.title}" (ID: ${note.id}, Scope: ${note.target_scope}, User: ${note.user_id})`);

        const { error: updateError, status, statusText } = await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('id', note.id);

        if (updateError) {
            console.error('Error de actualización detectado:', updateError);
        } else {
            console.log(`Respuesta de Supabase: Status ${status} (${statusText})`);
            console.log('NOTA: Si status es 204 pero no se marcó en DB, RLS bloqueó la fila silenciosamente.');
        }

        // Verificamos si realmente se actualizó
        const { data: verify } = await supabase.from('notifications').select('read_at').eq('id', note.id).single();
        console.log('Estado final en DB (read_at):', verify?.read_at || 'NULL (BLOQUEADO)');
    }

    testUpdate();
} catch (e) {
    console.error('Error en el script:', e.message);
}
