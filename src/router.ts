import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { createOpenRouterDecide } from './decide.js'
import { requestState } from './state.js'
import {
  MAX_HANDLERS,
  UNMATCHED,
  type Decision,
  type Destination,
  type JevHandler,
  type JevRouterOptions,
} from './types.js'

function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').slice(0, 200)
}

export type JevRouter = RequestHandler & {
  handle(intent: string, handler: JevHandler): JevRouter
  minConfidence: number
}

/**
 * Catch-all Express middleware. Register handlers with English, not URLs.
 * `app.use(api)` is the whole public API.
 */
export function JevRouter(options: JevRouterOptions = {}): JevRouter {
  const minConfidence = options.minConfidence ?? 0.65
  const skipPaths = new Set(['/health', ...(options.skipPaths ?? [])])
  const decide =
    options.decide ??
    createOpenRouterDecide({
      apiKey: options.apiKey,
      model: options.model,
      endpoint: options.endpoint,
      referer: options.referer,
      title: options.title,
    })

  const destinations: Destination[] = []
  const handlers = new Map<string, JevHandler>()

  function handle(intent: string, handler: JevHandler): JevRouter {
    if (typeof handler !== 'function') {
      throw new TypeError('jev-router: handle(intent, handler)')
    }
    const text = intent.trim()
    const name = handler.name
    if (!text) {
      throw new Error('jev-router: handle() needs an intent description')
    }
    if (!name || name === 'anonymous') {
      throw new Error(
        'jev-router: pass a named function so Jev can use handler.name as the choice key (arrows are anonymous)',
      )
    }
    if (name === UNMATCHED) {
      throw new Error(`jev-router: "${UNMATCHED}" is reserved`)
    }
    if (handlers.has(name)) {
      throw new Error(`jev-router: duplicate handler name "${name}"`)
    }
    if (handlers.size >= MAX_HANDLERS) {
      throw new Error(`jev-router: Jev Choice is capped at ${MAX_HANDLERS} handlers plus ${UNMATCHED}`)
    }

    destinations.push({ name, intent: text })
    handlers.set(name, handler)
    return api
  }

  function headers(res: Response, decision: Decision): void {
    res.setHeader('X-Jev-Handler', headerSafe(decision.choice))
    res.setHeader('X-Jev-Confidence', String(decision.confidence))
    res.setHeader('X-Jev-Model', decision.model)
  }

  function unmatched(res: Response, decision: Decision): void {
    headers(res, decision)
    res.status(404).json({
      error: 'unmatched',
      choice: decision.choice,
      confidence: decision.confidence,
      probabilities: decision.probabilities,
      model: decision.model,
    })
  }

  async function dispatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const path = req.path || '/'
      if (req.method === 'GET' && skipPaths.has(path)) {
        next()
        return
      }
      if (handlers.size === 0) {
        res.status(500).json({ error: 'no_handlers' })
        return
      }

      const decision = await decide(requestState(req), destinations)
      const low = decision.confidence < minConfidence
      const miss = decision.choice === UNMATCHED || !handlers.has(decision.choice)

      if (low || miss) {
        unmatched(res, decision)
        return
      }

      headers(res, decision)
      handlers.get(decision.choice)!(req, res, next)
    } catch (err) {
      next(err)
    }
  }

  const middleware: RequestHandler = (req, res, next) => {
    void dispatch(req, res, next)
  }

  const api = Object.assign(middleware, { handle, minConfidence }) as JevRouter
  return api
}

export const createJevRouter = JevRouter
