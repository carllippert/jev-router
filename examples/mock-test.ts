import assert from 'node:assert/strict'
import express from 'express'
import { JevRouter, UNMATCHED, type DecideFn } from '../src/index.ts'

const decide: DecideFn = async (state) => {
  const text = `${state.method} ${state.path} ${JSON.stringify(state.body ?? {})}`.toLowerCase()
  if (text.includes('health')) {
    throw new Error('health should not call decide')
  }
  if (text.includes('create') || text.includes('email')) {
    return {
      choice: 'createUser',
      confidence: 0.9,
      probabilities: { createUser: 0.9, listUsers: 0.05, [UNMATCHED]: 0.05 },
      model: 'mock',
    }
  }
  if (text.includes('user') || text.includes('people')) {
    return {
      choice: 'listUsers',
      confidence: 0.92,
      probabilities: { listUsers: 0.92, createUser: 0.04, [UNMATCHED]: 0.04 },
      model: 'mock',
    }
  }
  return {
    choice: UNMATCHED,
    confidence: 0.4,
    probabilities: { [UNMATCHED]: 0.7, listUsers: 0.2, createUser: 0.1 },
    model: 'mock',
  }
}

function listUsers(_req: express.Request, res: express.Response) {
  res.json({ users: [1] })
}

function createUser(_req: express.Request, res: express.Response) {
  res.status(201).json({ ok: true })
}

const api = JevRouter({ decide, minConfidence: 0.65 })
api.handle('List users', listUsers)
api.handle('Create a user', createUser)

const app = express()
app.use(express.json())
app.get('/health', (_req, res) => res.json({ ok: true }))
app.use(api)

const server = app.listen(0)
const { port } = server.address() as { port: number }
const base = `http://127.0.0.1:${port}`

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${base}${path}`, init)
  const json = await res.json()
  return { status: res.status, json, handler: res.headers.get('x-jev-handler') }
}

const health = await call('/health')
assert.equal(health.status, 200)
assert.equal(health.json.ok, true)
assert.equal(health.handler, null)

const list = await call('/please-list-the-people')
assert.equal(list.status, 200)
assert.equal(list.handler, 'listUsers')
assert.deepEqual(list.json, { users: [1] })

const create = await call('/', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'a@b.c' }),
})
assert.equal(create.status, 201)
assert.equal(create.handler, 'createUser')

const miss = await call('/zzzz-not-a-thing')
assert.equal(miss.status, 404)
assert.equal(miss.json.error, 'unmatched')

server.close()
console.log('mock router tests ok')
