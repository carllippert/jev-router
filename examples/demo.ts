import express from 'express'
import { JevRouter } from '../src/index.ts'

type User = { id: string; name: string; email: string }

const users: User[] = [
  { id: '1', name: 'Ada', email: 'ada@example.com' },
  { id: '2', name: 'Grace', email: 'grace@example.com' },
]

const api = JevRouter({ minConfidence: 0.65 })

function listUsers(_req: express.Request, res: express.Response) {
  res.json({ users })
}

function getUser(req: express.Request, res: express.Response) {
  const id =
    (typeof req.query.id === 'string' && req.query.id) ||
    (req.body && typeof req.body === 'object' && 'id' in req.body
      ? String((req.body as { id: unknown }).id)
      : undefined) ||
    req.path.split('/').filter(Boolean).at(-1)
  const user = users.find((u) => u.id === id)
  if (!user) {
    res.status(404).json({ error: 'not_found', id })
    return
  }
  res.json({ user })
}

function createUser(req: express.Request, res: express.Response) {
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}
  const email = typeof body.email === 'string' ? body.email : undefined
  const name = typeof body.name === 'string' ? body.name : email?.split('@')[0] ?? 'anon'
  if (!email) {
    res.status(400).json({ error: 'email_required' })
    return
  }
  const user: User = { id: String(users.length + 1), name, email }
  users.push(user)
  res.status(201).json({ user })
}

api.handle(
  'List all users. Collection read. GET-style; no body required. Phrases like list people, show users, everyone.',
  listUsers,
)
api.handle('Get one user. The id may be in the path, query string, or JSON body.', getUser)
api.handle('Create a user from JSON with name and/or email. POST-style write.', createUser)

const app = express()
app.use(express.json())
app.get('/health', (_req, res) => {
  res.json({ ok: true })
})
app.use(api)

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: err instanceof Error ? err.message : 'jev_failed' })
})

const port = Number(process.env.PORT) || 3000
app.listen(port, () => {
  console.log(`jev-router demo on http://localhost:${port}`)
  console.log('There is no route table. Try:')
  console.log('  curl http://localhost:3000/health')
  console.log('  curl http://localhost:3000/users')
  console.log('  curl http://localhost:3000/please-list-the-people')
  console.log(`  curl -X POST http://localhost:3000/ -H 'content-type: application/json' -d '{"email":"a@b.c"}'`)
})
