import { UNMATCHED } from './types.js'
import type { DecideFn, Decision, Destination, RequestState } from './types.js'

const DEFAULT_ENDPOINT = 'https://openrouter.ai/api/alpha/decisions'
const DEFAULT_MODEL = 'typesafe/jev-1.13'

type OpenRouterChoice = {
  type?: string
  choice?: string
  confidence?: number
  probabilities?: Record<string, number>
}

type OpenRouterResponse = {
  model?: string
  answers?: {
    destination?: OpenRouterChoice
  }
  error?: { message?: string }
  message?: string
}

export function createOpenRouterDecide(options: {
  apiKey?: string
  model?: string
  endpoint?: string
  referer?: string
  title?: string
}): DecideFn {
  const model = options.model ?? DEFAULT_MODEL
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT

  return async function decide(state: RequestState, destinations: Destination[]): Promise<Decision> {
    const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error(
        'jev-router: set OPENROUTER_API_KEY (or pass apiKey) to call Jev via OpenRouter',
      )
    }

    const criteria: Record<string, string> = {}
    for (const dest of destinations) {
      criteria[dest.name] = dest.intent
    }
    criteria[UNMATCHED] = 'The request does not match any registered handler.'

    const body = {
      model,
      state,
      questions: {
        destination: {
          type: 'choice',
          instructions:
            'Which registered handler should run for this HTTP request? Use method, path, query, and body as evidence. Pick none_of_the_above if nothing fits.',
          criteria,
        },
      },
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': options.referer ?? 'https://github.com/carllippert/jev-router',
        'X-Title': options.title ?? 'jev-router',
      },
      body: JSON.stringify(body),
    })

    const json = (await res.json()) as OpenRouterResponse
    if (!res.ok) {
      const msg = json.error?.message ?? json.message ?? res.statusText
      throw new Error(`jev-router: OpenRouter ${res.status}: ${msg}`)
    }

    const answer = json.answers?.destination
    const choice = answer?.choice ?? UNMATCHED
    const probabilities = answer?.probabilities ?? {}
    const confidence =
      typeof answer?.confidence === 'number'
        ? answer.confidence
        : probabilities[choice] ?? 0

    return {
      choice,
      confidence,
      probabilities,
      model: json.model ?? model,
    }
  }
}
