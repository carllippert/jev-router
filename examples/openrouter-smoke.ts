import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadKey(): string {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY
  const candidates = [
    resolve(import.meta.dirname, '../../yolo/.env'),
    resolve(import.meta.dirname, '../../mariana_tools/.env'),
  ]
  for (const file of candidates) {
    try {
      const text = readFileSync(file, 'utf8')
      const match = text.match(/^OPENROUTER_API_KEY=(.+)$/m)
      if (match?.[1]) return match[1].trim()
    } catch {
      /* next */
    }
  }
  throw new Error('OPENROUTER_API_KEY not found')
}

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const s = createServer()
    s.listen(0, () => {
      const addr = s.address()
      if (!addr || typeof addr === 'string') {
        reject(new Error('no port'))
        return
      }
      const port = addr.port
      s.close(() => resolvePort(port))
    })
  })
}

const apiKey = loadKey()
const port = await freePort()
const child = spawn(process.execPath, ['--import', 'tsx', 'examples/demo.ts'], {
  cwd: resolve(import.meta.dirname, '..'),
  env: { ...process.env, OPENROUTER_API_KEY: apiKey, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let ready = ''
child.stdout?.on('data', (chunk) => {
  ready += chunk.toString()
})
child.stderr?.on('data', (chunk) => {
  process.stderr.write(chunk)
})

await new Promise<void>((resolveReady, reject) => {
  const t = setTimeout(() => reject(new Error('demo did not start')), 8000)
  const check = () => {
    if (ready.includes('jev-router demo')) {
      clearTimeout(t)
      resolveReady()
    }
  }
  child.stdout?.on('data', check)
  check()
})

const base = `http://127.0.0.1:${port}`

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${base}${path}`, init)
  const json = await res.json()
  return {
    path,
    status: res.status,
    handler: res.headers.get('x-jev-handler'),
    confidence: res.headers.get('x-jev-confidence'),
    json,
  }
}

try {
  const health = await call('/health')
  const listA = await call('/users')
  const listB = await call('/please-list-the-people')
  const create = await call('/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.c', name: 'Pat' }),
  })
  const miss = await call('/asdfgh-quantum-toaster-policy')

  console.log(JSON.stringify({ health, listA, listB, create, miss }, null, 2))

  if (health.status !== 200 || health.handler) throw new Error('health should bypass Jev')
  if (listA.handler !== 'listUsers' || listA.status !== 200) throw new Error('GET /users should listUsers')
  if (listB.handler !== 'listUsers' || listB.status !== 200) throw new Error('messy path should listUsers')
  if (create.handler !== 'createUser' || create.status !== 201) throw new Error('POST email should createUser')
  if (miss.status !== 404) throw new Error('garbage should 404')
  console.log('openrouter smoke ok')
} finally {
  child.kill('SIGTERM')
}
