export type GroqMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export type GroqGenerateOptions = {
  messages?: GroqMessage[]
  prompt?: string
  systemPrompt?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

/**
 * Ultra-fast inference client for GroqCloud API using native fetch
 * Default model: llama-3.3-70b-versatile
 */
export async function generateTextWithGroq(options: GroqGenerateOptions): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY in environment variables (.env.local)")
  }

  const model = options.model || "llama-3.3-70b-versatile"
  const messages: GroqMessage[] = []

  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt })
  }

  if (options.messages && options.messages.length > 0) {
    messages.push(...options.messages)
  } else if (options.prompt) {
    messages.push({ role: "user", content: options.prompt })
  }

  if (messages.length === 0) {
    throw new Error("No messages or prompt provided to generateTextWithGroq")
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 1500,
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Groq API error (${res.status}): ${errorText}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content

  if (!content) {
    throw new Error("No content generated from Groq API")
  }

  return content.trim()
}

/**
 * Instantly enhances a resume bullet point with strong action verbs & impact phrasing
 */
export async function enhanceResumeBulletWithGroq(
  originalBullet: string,
  targetRole?: string
): Promise<string> {
  const roleContext = targetRole
    ? `Tailor the bullet specifically for a ${targetRole} position.`
    : ""

  const prompt = `Rewrite and enhance the following resume bullet point to make it more impactful, concise, and professional. Use strong action verbs and emphasize quantifiable achievements where applicable. ${roleContext}
Return ONLY the improved single bullet point string without introductory text or quotation marks.

Original bullet:
"${originalBullet}"`

  return generateTextWithGroq({
    prompt,
    temperature: 0.2,
    maxTokens: 150,
  })
}

/**
 * Generates a tailored cover letter at lightning speed using Groq Llama 3.3 70B
 */
export async function generateCoverLetterWithGroq(params: {
  candidateName: string
  candidateSummary: string
  targetTitle: string
  targetCompany: string
  jobDescription?: string
}): Promise<string> {
  const systemPrompt =
    "You are an expert career strategist and executive speechwriter. Write compelling, authentic cover letters that stand out."

  const prompt = `Write a persuasive, highly tailored cover letter for ${params.candidateName || "the candidate"} applying for the role of ${params.targetTitle} at ${params.targetCompany}.

Candidate Profile Summary:
${params.candidateSummary || "Experienced professional looking to contribute strongly."}

${
  params.jobDescription
    ? `Target Job Description Highlights:\n${params.jobDescription}\n`
    : ""
}

Write a professional 3-to-4 paragraph cover letter clearly highlighting why the candidate is a standout fit for ${params.targetCompany}. Do not include placeholders like "[Your Phone Number]" — use professional sign-off with ${params.candidateName}.`

  return generateTextWithGroq({
    systemPrompt,
    prompt,
    temperature: 0.4,
    maxTokens: 1200,
  })
}

/**
 * Instantly tailors an executive summary for a specific job title
 */
export async function tailorSummaryWithGroq(
  currentSummary: string,
  targetRole: string
): Promise<string> {
  const prompt = `Rewrite the following professional summary so that it strongly positions the candidate for a "${targetRole}" role while retaining truthfulness. Return ONLY the polished paragraph.

Current Summary:
${currentSummary}`

  return generateTextWithGroq({
    prompt,
    temperature: 0.3,
    maxTokens: 250,
  })
}
