import { createClient } from '@supabase/supabase-js'
import { useStore } from '../store'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)

// Inject traceability headers during impersonation (Visitor Admin Pattern)
const originalInvoke = supabase.functions.invoke.bind(supabase.functions)
supabase.functions.invoke = async (functionName: string, options: any = {}) => {
  const store = useStore.getState()

  if (store.isImpersonating && store.impersonatedCompanyId) {
    console.log(`[Supabase] Injecting traceability headers for impersonation on: ${functionName}`)

    const headers = {
      ...(options.headers || {}),
      'x-platform-actor-id': (await supabase.auth.getUser()).data.user?.id || 'unknown',
      'x-impersonation-active': 'true',
      'x-impersonated-company-id': store.impersonatedCompanyId
    }

    options.headers = headers
  }

  return originalInvoke(functionName, options)
}
