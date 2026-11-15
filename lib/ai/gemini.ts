import "server-only"

import { GoogleGenAI, ThinkingLevel } from "@google/genai"

import { instrument } from "./telemetry"
import type { AIProvider } from "./types"

const THINKING_LEVEL = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
} as const

export function createGeminiProvider(
  apiKey: string,
  model: string
): AIProvider {
  const client = new GoogleGenAI({ apiKey })

  return instrument(
    "gemini",
    model,
    true,
    async ({ prompt, system, json, temperature, files, reasoning }, signal) => {
      const contents = files?.length
        ? [
            {
              role: "user",
              parts: [
                ...files.map((f) => ({
                  inlineData: {
                    mimeType: f.mimeType,
                    data: Buffer.from(f.data).toString("base64"),
                  },
                })),
                { text: prompt },
              ],
            },
          ]
        : prompt
      const response = await client.models.generateContent({
        model,
        contents,
        config: {
          abortSignal: signal,
          systemInstruction: system,
          temperature,
          responseMimeType: json ? "application/json" : undefined,
          thinkingConfig: reasoning
            ? { thinkingLevel: THINKING_LEVEL[reasoning] }
            : undefined,
        },
      })
      return {
        text: response.text ?? "",
        inputTokens: response.usageMetadata?.promptTokenCount,
        outputTokens: response.usageMetadata?.candidatesTokenCount,
      }
    }
  )
}
