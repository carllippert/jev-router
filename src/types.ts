import type { NextFunction, Request, RequestHandler, Response } from 'express'

export const UNMATCHED = 'none_of_the_above'
export const MAX_HANDLERS = 254

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type RequestState = {
  method: string
  path: string
  query: Request['query']
  contentType: string | undefined
  body: unknown
}

export type Destination = {
  name: string
  intent: string
}

export type Decision = {
  choice: string
  confidence: number
  probabilities: Record<string, number>
  model: string
}

export type DecideFn = (
  state: RequestState,
  destinations: Destination[],
) => Promise<Decision>

export type JevRouterOptions = {
  /** Default 0.65. Below this, the request is unmatched. */
  minConfidence?: number
  /**
   * OpenRouter model id. Default `typesafe/jev-1.13`.
   * `~typesafe/jev-latest` always tracks the current Jev.
   */
  model?: string
  apiKey?: string
  /** OpenRouter Decisions URL. */
  endpoint?: string
  referer?: string
  title?: string
  decide?: DecideFn
  /** Extra GET paths that never call Jev. `/health` is always skipped. */
  skipPaths?: string[]
}

export type JevHandler = RequestHandler

export type JevDispatch = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>
