import { parseResumeWithGemini } from "@/lib/ai/gemini"
import { generateTextWithGroq } from "@/lib/ai/groq"
import type { ParsedResume } from "@/types/resume"

/**
 * Multi-Model AI Router
 * Orchestrates tasks between Google Gemini AI (document understanding)
 * and Groq Llama 3.3 70B (ultra-fast interactive text generation & tailoring)
 */

export async function parseResumeDocument(
  fileBuffer: Buffer,
  mimeType: string,
  extractedText?: string
): Promise<ParsedResume> {
  // Google Gemini AI is optimized for multimodal document understanding & structured resume JSON extraction
  return parseResumeWithGemini(fileBuffer, mimeType, extractedText)
}

export async function generateFastText(params: {
  prompt: string
  systemPrompt?: string
  temperature?: number
}): Promise<string> {
  // 1. Try Groq first for ultra-fast generation if GROQ_API_KEY is present
  if (process.env.GROQ_API_KEY) {
    try {
      return await generateTextWithGroq({
        prompt: params.prompt,
        systemPrompt: params.systemPrompt,
        temperature: params.temperature,
      })
    } catch (groqErr) {
      console.warn("Groq generation failed, falling back to Gemini:", groqErr)
    }
  }

  // 2. Fallback to Google Gemini REST API (gemini-1.5-flash)
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("Neither GROQ_API_KEY nor GEMINI_API_KEY is configured.")
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
  const fullPrompt = params.systemPrompt
    ? `${params.systemPrompt}\n\n${params.prompt}`
    : params.prompt

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: params.temperature ?? 0.3,
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini fallback error (${res.status}): ${errText}`)
  }

  const data = await res.json()
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    data?.candidates?.[0]?.output

  if (!text) {
    throw new Error("No output generated from AI router")
  }

  return text.trim()
}
