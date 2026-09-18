import type { Request } from 'express'
import type { RequestState } from './types.js'

const BODY_CHARS = 4000
const SECRET_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'proxy-authorization'])

function truncate(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length > BODY_CHARS ? `${value.slice(0, BODY_CHARS)}…` : value
  }
  if (value && typeof value === 'object') {
    try {
      const json = JSON.stringify(value)
      if (json.length <= BODY_CHARS) return value
      return { _truncated: json.slice(0, BODY_CHARS) }
    } catch {
      return '[unserializable]'
    }
  }
  return value
}

export function requestState(req: Request): RequestState {
  const contentType = req.headers['content-type']
  void SECRET_HEADERS
  return {
    method: req.method,
    path: req.path || req.url.split('?')[0] || '/',
    query: req.query,
    contentType: Array.isArray(contentType) ? contentType[0] : contentType,
    body: truncate(req.body),
  }
}
