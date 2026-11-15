export type AIProviderName = "gemini" | "groq"

export interface GenerateTextOptions {
  prompt: string
  system?: string
  /** Ask the model to reply with a JSON object. */
  json?: boolean
  temperature?: number
  /**
   * How much the model may "think" before answering, for models that reason.
   * Lower is much faster: structured extraction rarely needs more than "low".
   * Ignored by models without reasoning controls.
   */
  reasoning?: "minimal" | "low" | "medium" | "high"
  /**
   * Files sent alongside the prompt (e.g. a scanned PDF). Only providers with
   * `supportsFiles` accept them; others throw.
   */
  files?: { data: Uint8Array; mimeType: string }[]
  /** What the call is for, recorded in telemetry ("analysis", "ocr", …). */
  feature?: string
  /** Per-attempt timeout. Default 45 s. */
  timeoutMs?: number
  /** Attempts on 429/5xx/timeouts, including the first. Default 3. */
  attempts?: number
}

/** Minimal provider contract. Features add capabilities in later phases. */
export interface AIProvider {
  readonly name: AIProviderName
  readonly model: string
  /** Whether `generateText` accepts `files`. */
  readonly supportsFiles: boolean
  generateText(options: GenerateTextOptions): Promise<string>
}
