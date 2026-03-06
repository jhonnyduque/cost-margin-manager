
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkNotifications() {
    console.log('--- AUDITORÍA DE NOTIFICACIONES ---')
    const { data: notes, error } = await supabase
        .from('notifications')
        .select('id, title, target_scope, user_id, read_at')
        .order('created_at', { ascending: false })
        .limit(10)

    if (error) {
        console.error('Error fetching notifications:', error)
        return
    }

    console.log(`Encontradas ${notes.length} notificaciones recientes:`)
    console.table(notes)

    const unread = notes.filter(n => !n.read_at).length
    console.log(`No leídas: ${unread}`)
}

checkNotifications()
