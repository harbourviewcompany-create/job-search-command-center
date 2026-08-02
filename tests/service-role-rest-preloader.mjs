const nativeFetch = globalThis.fetch
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for connected runtime fixture mutations.')
}

globalThis.fetch = async function serviceRoleFixtureFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()

  if (url.includes('/rest/v1/') && method !== 'GET' && method !== 'HEAD') {
    const sourceHeaders = new Headers(
      init.headers ?? (input instanceof Request ? input.headers : undefined)
    )
    if (!anonKey || sourceHeaders.get('apikey') === anonKey) {
      sourceHeaders.set('apikey', serviceRoleKey)
      sourceHeaders.set('Authorization', `Bearer ${serviceRoleKey}`)
      init = { ...init, headers: sourceHeaders }
    }
  }

  return nativeFetch(input, init)
}
