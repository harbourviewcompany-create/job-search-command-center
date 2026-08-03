import http from 'node:http'

const port = Number(process.env.LOCAL_SUPABASE_PROXY_PORT ?? 54321)
const postgrestUrl = new URL(process.env.LOCAL_POSTGREST_URL ?? 'http://127.0.0.1:3001')

function json(response, status, body) {
  const content = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(content),
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, apikey, content-type, prefer, range, accept-profile, content-profile',
  })
  response.end(content)
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': 'authorization, apikey, content-type, prefer, range, accept-profile, content-profile',
    })
    response.end()
    return
  }

  if (requestUrl.pathname === '/health') {
    json(response, 200, { ok: true })
    return
  }

  if (requestUrl.pathname === '/auth/v1/settings') {
    json(response, 200, {
      external: {},
      disable_signup: true,
      mailer_autoconfirm: false,
      phone_autoconfirm: false,
    })
    return
  }

  if (requestUrl.pathname.startsWith('/auth/v1/')) {
    json(response, 401, { message: 'No authenticated user in connected browser verification.' })
    return
  }

  if (!requestUrl.pathname.startsWith('/rest/v1')) {
    json(response, 404, { message: 'Local Supabase verification route not found.' })
    return
  }

  const restPath = requestUrl.pathname.slice('/rest/v1'.length) || '/'
  const target = new URL(`${restPath}${requestUrl.search}`, postgrestUrl)
  const headers = { ...request.headers, host: target.host }
  delete headers['content-length']

  const proxyRequest = http.request(target, {
    method: request.method,
    headers,
  }, (proxyResponse) => {
    response.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers)
    proxyResponse.pipe(response)
  })

  proxyRequest.on('error', (error) => {
    json(response, 502, { message: error.message })
  })
  request.pipe(proxyRequest)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Local Supabase verification proxy listening on http://127.0.0.1:${port}`)
})

function shutdown() {
  server.close(() => process.exit(0))
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
