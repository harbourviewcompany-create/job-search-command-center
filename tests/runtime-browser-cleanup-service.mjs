if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Service-role credentials are not configured; no connected runtime fixtures could have been created.')
  process.exit(0)
}

await import('./service-role-rest-preloader.mjs')
await import('./runtime-browser-cleanup.mjs')
