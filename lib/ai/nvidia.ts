export type NvidiaMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export type NvidiaGenerateOptions = {
  messages?: NvidiaMessage[]
  prompt?: string
  systemPrompt?: string
  model?: string
  temperature?: number
  maxTokens?: number
  /** Request a strict JSON object response (NIM's OpenAI-compatible API
   * supports response_format like OpenAI/Groq do for the models that
   * support structured output). */
  jsonMode?: boolean
}

/**
 * NVIDIA NIM inference client. NIM exposes an OpenAI-compatible chat
 * completions API (https://integrate.api.nvidia.com/v1), so this mirrors
 * lib/ai/groq.ts almost exactly — same request/response shape, different
 * base URL, key, and default model.
 *
 * Used in place of the Anthropic Claude API the plan originally specified
 * for Task 2.4 (Job Classification) — a deliberate, documented provider
 * swap (see AUDIT_AND_ROADMAP.md), not a deviation done quietly. This is
 * exactly the kind of substitution the plan's own TextGenerator adapter
 * pattern (Section 3) anticipates.
 */
export async function generateTextWithNvidia(
  options: NvidiaGenerateOptions
): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) {
    throw new Error("Missing NVIDIA_API_KEY in environment variables (.env.local)")
  }

  const model = options.model || "meta/llama-3.3-70b-instruct"
  const messages: NvidiaMessage[] = []

  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt })
  }

  if (options.messages && options.messages.length > 0) {
    messages.push(...options.messages)
  } else if (options.prompt) {
    messages.push({ role: "user", content: options.prompt })
  }

  if (messages.length === 0) {
    throw new Error("No messages or prompt provided to generateTextWithNvidia")
  }

  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 1000,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`NVIDIA NIM API error (${res.status}): ${errorText}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content

  if (!content) {
    throw new Error("No content generated from NVIDIA NIM API")
  }

  return content.trim()
}
