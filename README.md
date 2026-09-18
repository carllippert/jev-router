# jev-router

Express with no routes. [Jev](https://typesafe.ai) picks which handler runs.

There is no `GET /users/:id`. Clients hit the origin with whatever path and body they want. Method, URL, and JSON are evidence. You register English intents, not paths. Jev’s Choice keys are the **function names** so the payload stays small.

```ts
import express from 'express'
import { JevRouter } from 'jev-router'

const api = JevRouter()

function listUsers(_req, res) {
  res.json({ users: [] })
}

function createUser(req, res) {
  res.status(201).json({ user: req.body })
}

api.handle('List users. Collection read; no body required.', listUsers)
api.handle('Create a user from JSON with name and/or email.', createUser)

const app = express()
app.use(express.json())
app.get('/health', (_req, res) => res.json({ ok: true })) // never calls Jev
app.use(api) // this is the API
```

These can all run the list-users intent:

```bash
curl http://localhost:3000/users
curl http://localhost:3000/please-list-the-people
curl -X POST http://localhost:3000/ -H 'content-type: application/json' \
  -d '{"please":"list people"}'
```

## Install

```bash
npm install jev-router express
```

Node 20+. Set an OpenRouter key — Jev is called through the [Decisions API](https://openrouter.ai/typesafe/jev-1.13), not chat completions:

```bash
export OPENROUTER_API_KEY=sk-or-...
```

Pin `typesafe/jev-1.13` by default. Pass `model: '~typesafe/jev-latest'` to track current Jev.

## How it works

1. You register handlers with English (`handle(intent, namedFn)`). There is no path. The Choice key is `fn.name`.
2. Every request (except `GET /health`) becomes `{ method, path, query, contentType, body }`.
3. One Jev **Choice** runs over those function names plus `none_of_the_above`; the sentences are the criteria.
4. If `confidence < 0.65` (configurable) or the pick is unmatched → **404** with the full probability dump.
5. Otherwise that function runs. Jev cannot invent a new handler. Anonymous arrows have no name — use `function listUsers(...)`.

Headers on every Jev response:

- `X-Jev-Handler`
- `X-Jev-Confidence`
- `X-Jev-Model`

Put **auth in front** of `app.use(api)`. Do not let the model choose privileged handlers for anonymous traffic.

## Options

```ts
JevRouter({
  minConfidence: 0.65,
  model: 'typesafe/jev-1.13',
  apiKey: process.env.OPENROUTER_API_KEY,
  skipPaths: ['/health'],
})
```

## Limits

- Choice is capped at **255** options. This library keeps 254 handlers + `none_of_the_above`.
- Typical Jev latency is ~70–500ms. Fine for a weird RPC; not a hot REST path.
- URLs are not the interface. OpenAPI and CDN cache keys do not apply.
- Body is truncated (~4k chars). `authorization` / `cookie` are not sent as headers (they were never part of state).

## Demo

```bash
export OPENROUTER_API_KEY=sk-or-...
npx tsx examples/demo.ts
```

## License

MIT
