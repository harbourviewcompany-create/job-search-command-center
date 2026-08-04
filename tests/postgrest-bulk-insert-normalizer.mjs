const nativeFetch = globalThis.fetch

/**
 * PostgREST requires every object in a bulk insert to expose the same keys.
 * Deterministic fixtures intentionally mix provider records with nullable
 * fields, so normalize only JSON-array POST bodies sent to the jobs endpoint.
 */
globalThis.fetch = async function normalizedPostgrestFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()

  if (
    method === 'POST' &&
    url.includes('/rest/v1/jobs') &&
    typeof init.body === 'string'
  ) {
    try {
      const rows = JSON.parse(init.body)
      if (Array.isArray(rows) && rows.length > 1 && rows.every((row) => row && typeof row === 'object')) {
        const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
        init = {
          ...init,
          body: JSON.stringify(
            rows.map((row) => Object.fromEntries(keys.map((key) => [key, row[key] ?? null])))
          ),
        }
      }
    } catch {
      // Preserve the original request; the existing harness will report any
      // malformed JSON or API response with its normal evidence path.
    }
  }

  return nativeFetch(input, init)
}
