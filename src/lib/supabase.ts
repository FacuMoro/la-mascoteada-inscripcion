import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** URL base del proyecto (sin /rest/v1). Si copiaste la URL de la API, la acortamos. */
function normalizeSupabaseUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '')
  if (u.endsWith('/rest/v1')) {
    u = u.slice(0, -'/rest/v1'.length).replace(/\/+$/, '')
  }
  return u
}

const urlRaw = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const url = urlRaw ? normalizeSupabaseUrl(urlRaw) : undefined

/** Solo crea el cliente si hay URL y clave; si no, la app puede renderizar (p. ej. falta env en Cloudflare). */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null
