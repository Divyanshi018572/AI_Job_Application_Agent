import { generateTextWithGroq } from "@/lib/ai/groq"
import type { ParsedResume } from "@/types/resume"

const RESUME_EXTRACTION_PROMPT = `
You are an expert AI recruiter and resume parser.
Analyze the provided resume document or text carefully and extract all information into a strict JSON format.

Return ONLY a valid JSON object matching the exact structure below. Do not include markdown code blocks, comments, or explanations outside the JSON object.

Structure required:
{
  "profile": {
    "fullName": "Full name of candidate or empty string",
    "email": "Email address or empty string",
    "phone": "Phone number or empty string",
    "location": "City, State/Country or empty string",
    "links": {
      "linkedin": "LinkedIn URL or empty string",
      "github": "GitHub URL or empty string",
      "portfolio": "Personal website or portfolio URL or empty string",
      "twitter": "Twitter/X URL or empty string",
      "other": "Any other notable professional link or empty string"
    }
  },
  "summary": "Professional executive summary or bio summarizing experience and strengths",
  "skills": ["Skill 1", "Skill 2", "Skill 3", "..."],
  "workExperience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "duration": "e.g., Jan 2021 - Present or 2019-2022",
      "startDate": "YYYY-MM or YYYY",
      "endDate": "YYYY-MM or Present",
      "location": "City, Country or Remote",
      "responsibilities": [
        "Key achievement or responsibility bullet point 1",
        "Key achievement or responsibility bullet point 2"
      ]
    }
  ],
  "education": [
    {
      "institution": "University or School Name",
      "degree": "Degree type (e.g., Bachelor of Science)",
      "field": "Major or Field of study (e.g., Computer Science)",
      "duration": "e.g., 2016 - 2020",
      "startDate": "YYYY",
      "endDate": "YYYY"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description of the project and impact",
      "url": "Project link or repository URL",
      "technologies": ["Tech 1", "Tech 2"]
    }
  ],
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "date": "Issue Date or Year",
      "url": "Credential URL if available"
    }
  ]
}
`

function cleanJsonString(raw: string): string {
  let cleaned = raw.trim()
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json/, "").trim()
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```/, "").trim()
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.replace(/```$/, "").trim()
  }
  return cleaned
}

async function getAvailableGeminiModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    )
    if (!res.ok) {
      return ["gemini-1.5-flash", "gemini-2.0-flash"]
    }
    const data = await res.json()
    const models = (data.models || [])
      .filter(
        (m: any) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes("generateContent")
      )
      .map((m: any) => m.name.replace("models/", ""))

    const flashModels = models.filter((name: string) => name.includes("flash"))
    const otherModels = models.filter((name: string) => !name.includes("flash"))
    const discovered = [...flashModels, ...otherModels]
    return discovered.length > 0
      ? discovered
      : ["gemini-1.5-flash", "gemini-2.0-flash"]
  } catch {
    return ["gemini-1.5-flash", "gemini-2.0-flash"]
  }
}

export async function parseResumeWithGemini(
  fileBuffer: Buffer,
  mimeType: string,
  extractedText?: string
): Promise<ParsedResume> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_API_KEY

  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY in environment variables. Please add GEMINI_API_KEY to your .env.local file."
    )
  }

  const availableModels = await getAvailableGeminiModels(apiKey)

  // First try using official @google/genai SDK if available
  try {
    const genaiModule = await import("@google/genai")
    if (genaiModule && genaiModule.GoogleGenAI) {
      const ai = new genaiModule.GoogleGenAI({ apiKey })
      const contentsPayload: any[] = []

      if (extractedText && extractedText.trim().length > 50) {
        contentsPayload.push({
          text: `${RESUME_EXTRACTION_PROMPT}\n\nCandidate Resume Text:\n${extractedText}`,
        })
      } else {
        contentsPayload.push({
          inlineData: {
            mimeType: mimeType || "application/pdf",
            data: fileBuffer.toString("base64"),
          },
        })
        contentsPayload.push({ text: RESUME_EXTRACTION_PROMPT })
      }

      const sdkModel = availableModels[0] || "gemini-1.5-flash"
      const response = await ai.models.generateContent({
        model: sdkModel,
        contents: contentsPayload,
        config: {
          responseMimeType: "application/json",
        },
      })

      const responseText = response.text
      if (responseText) {
        const parsed = JSON.parse(cleanJsonString(responseText)) as ParsedResume
        return normalizeParsedResume(parsed)
      }
    }
  } catch (err: any) {
    // Fallback to Google Gemini REST API if SDK call fails or model fallback needed
    console.warn("Gemini SDK call fallback triggered:", err?.message || err)
  }

  // Fallback to direct Gemini REST API call (works universally with fetch)
  let lastError: Error | null = null

  for (const modelName of availableModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`

      const parts: any[] = []
      if (extractedText && extractedText.trim().length > 50) {
        parts.push({
          text: `${RESUME_EXTRACTION_PROMPT}\n\nCandidate Resume Text:\n${extractedText}`,
        })
      } else {
        parts.push({
          inline_data: {
            mime_type: mimeType || "application/pdf",
            data: fileBuffer.toString("base64"),
          },
        })
        parts.push({ text: RESUME_EXTRACTION_PROMPT })
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Gemini API error (${res.status}): ${errorText}`)
      }

      const data = await res.json()
      const rawText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        data?.candidates?.[0]?.output

      if (!rawText) {
        throw new Error("No output generated from Gemini API")
      }

      const parsed = JSON.parse(cleanJsonString(rawText)) as ParsedResume
      return normalizeParsedResume(parsed)
    } catch (e: any) {
      lastError = e
    }
  }

  // 3. High-Availability Fallback: Try Groq if Gemini is rate-limited and we have extracted text
  if (
    process.env.GROQ_API_KEY &&
    process.env.GROQ_API_KEY !== "your-groq-api-key-here" &&
    extractedText &&
    extractedText.trim().length > 50
  ) {
    try {
      console.log(
        "Gemini rate-limited. Falling back to Groq Llama 3.3 70B for resume parsing..."
      )
      const groqRawText = await generateTextWithGroq({
        systemPrompt:
          "You are an expert AI recruiter and resume parser. Return ONLY a valid JSON object matching the exact schema requested.",
        prompt: `${RESUME_EXTRACTION_PROMPT}\n\nCandidate Resume Text:\n${extractedText}`,
        temperature: 0.1,
        maxTokens: 3000,
      })
      const parsed = JSON.parse(cleanJsonString(groqRawText)) as ParsedResume
      return normalizeParsedResume(parsed)
    } catch (groqErr: any) {
      console.warn("Groq fallback parsing also failed:", groqErr?.message || groqErr)
    }
  }

  const errMsg = lastError?.message || ""
  if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("limit: 0")) {
    throw new Error(
      "Google Gemini API rate limit or Free Tier quota reached. Please check your Google AI Studio quota limits or add a free GROQ_API_KEY to your .env.local file for instant fallback."
    )
  }

  throw lastError || new Error("Failed to parse resume with Google Gemini AI")
}

function normalizeParsedResume(parsed: Partial<ParsedResume>): ParsedResume {
  return {
    profile: {
      fullName: parsed.profile?.fullName || "",
      email: parsed.profile?.email || "",
      phone: parsed.profile?.phone || "",
      location: parsed.profile?.location || "",
      links: {
        linkedin: parsed.profile?.links?.linkedin || "",
        github: parsed.profile?.links?.github || "",
        portfolio: parsed.profile?.links?.portfolio || "",
        twitter: parsed.profile?.links?.twitter || "",
        other: parsed.profile?.links?.other || "",
      },
    },
    summary: parsed.summary || "",
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    workExperience: Array.isArray(parsed.workExperience)
      ? parsed.workExperience.map((exp, idx) => ({
          id: exp.id || `exp-${idx}`,
          company: exp.company || "",
          title: exp.title || "",
          duration: exp.duration || "",
          startDate: exp.startDate || "",
          endDate: exp.endDate || "",
          location: exp.location || "",
          responsibilities: Array.isArray(exp.responsibilities)
            ? exp.responsibilities
            : [],
        }))
      : [],
    education: Array.isArray(parsed.education)
      ? parsed.education.map((edu, idx) => ({
          id: edu.id || `edu-${idx}`,
          institution: edu.institution || "",
          degree: edu.degree || "",
          field: edu.field || "",
          duration: edu.duration || "",
          startDate: edu.startDate || "",
          endDate: edu.endDate || "",
        }))
      : [],
    projects: Array.isArray(parsed.projects)
      ? parsed.projects.map((proj, idx) => ({
          id: proj.id || `proj-${idx}`,
          name: proj.name || "",
          description: proj.description || "",
          url: proj.url || "",
          technologies: Array.isArray(proj.technologies)
            ? proj.technologies
            : [],
        }))
      : [],
    certifications: Array.isArray(parsed.certifications)
      ? parsed.certifications.map((cert, idx) => ({
          id: cert.id || `cert-${idx}`,
          name: cert.name || "",
          issuer: cert.issuer || "",
          date: cert.date || "",
          url: cert.url || "",
        }))
      : [],
  }
}
