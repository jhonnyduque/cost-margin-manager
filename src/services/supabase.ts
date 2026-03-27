import { createClient } from '@supabase/supabase-js'
import { useStore } from '../store'

// 🛡️ Cliente unificado a la Nube (evitando conflictos locales/remotos)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    realtime: {
      enabled: false // 🚀 SILENCIAR WEBSOCKETS (no los usamos en este flujo)
    }
  }
)

// 🔥 Inject traceability headers during impersonation (Visitor Admin Pattern)
const originalInvoke = supabase.functions.invoke.bind(supabase.functions)

supabase.functions.invoke = async (functionName: string, options: any = {}) => {
  const store = useStore.getState()

  // Solo inyectar headers si hay una suplantación activa
  if (store.isImpersonating && store.impersonatedCompanyId) {
    const { data: { session } } = await supabase.auth.getSession()
    
    options.headers = {
      ...(options.headers || {}),
      'x-platform-actor-id': session?.user?.id || 'unknown',
      'x-impersonation-active': 'true',
      'x-impersonated-company-id': store.impersonatedCompanyId
    }
  }

  return originalInvoke(functionName, options)
}