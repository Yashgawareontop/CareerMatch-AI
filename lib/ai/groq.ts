import "server-only"

import Groq from "groq-sdk"

import { instrument } from "./telemetry"
import type { AIProvider } from "./types"

const REASONING_MODEL = /gpt-oss|qwen3/i

export function createGroqProvider(apiKey: string, model: string): AIProvider {
  // Retries and timeouts are handled by `instrument`, so every attempt is
  // counted and logged the same way for both providers.
  const client = new Groq({ apiKey, maxRetries: 0 })

  return instrument(
    "groq",
    model,
    false,
    async ({ prompt, system, json, temperature, files, reasoning }, signal) => {
      if (files?.length) {
        throw new Error("The Groq provider does not accept file attachments")
      }
      const completion = await client.chat.completions.create(
        {
          model,
          temperature,
          response_format: json ? { type: "json_object" } : undefined,
          // Only reasoning models (gpt-oss, qwen3) accept reasoning_effort.
          // gpt-oss has no "minimal" level; "low" is its fastest.
          reasoning_effort:
            reasoning && REASONING_MODEL.test(model)
              ? reasoning === "minimal"
                ? "low"
                : reasoning
              : undefined,
          messages: [
            ...(system ? [{ role: "system" as const, content: system }] : []),
            { role: "user" as const, content: prompt },
          ],
        },
        { signal }
      )
      return {
        text: completion.choices[0]?.message?.content ?? "",
        inputTokens: completion.usage?.prompt_tokens,
        outputTokens: completion.usage?.completion_tokens,
      }
    }
  )
}
