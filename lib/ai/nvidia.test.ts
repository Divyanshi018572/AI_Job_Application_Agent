import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { generateTextWithNvidia } from "@/lib/ai/nvidia"

function mockFetchOnce(response: { ok: boolean; status: number; json?: () => Promise<unknown> }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValueOnce({
      ok: response.ok,
      status: response.status,
      json: response.json ?? (() => Promise.resolve({})),
      text: () => Promise.resolve("error body"),
    })
  )
}

const originalEnv = process.env.NVIDIA_API_KEY

beforeEach(() => {
  process.env.NVIDIA_API_KEY = "test-key"
})

afterEach(() => {
  vi.unstubAllGlobals()
  process.env.NVIDIA_API_KEY = originalEnv
})

describe("generateTextWithNvidia", () => {
  it("throws a clear error when NVIDIA_API_KEY is missing", async () => {
    delete process.env.NVIDIA_API_KEY
    await expect(generateTextWithNvidia({ prompt: "hi" })).rejects.toThrow(
      /NVIDIA_API_KEY/
    )
  })

  it("throws when neither prompt, systemPrompt, nor messages are provided", async () => {
    await expect(generateTextWithNvidia({})).rejects.toThrow(/No messages or prompt/)
  })

  it("returns the trimmed content from a successful response", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ choices: [{ message: { content: "  hello world  " } }] }),
    })

    const result = await generateTextWithNvidia({ prompt: "say hi" })
    expect(result).toBe("hello world")
  })

  it("sends the OpenAI-compatible request shape NIM expects", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ choices: [{ message: { content: "ok" } }] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await generateTextWithNvidia({
      systemPrompt: "system",
      prompt: "user prompt",
      model: "some/model",
      jsonMode: true,
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions")
    expect(init.headers.Authorization).toBe("Bearer test-key")
    const body = JSON.parse(init.body)
    expect(body.model).toBe("some/model")
    expect(body.messages).toEqual([
      { role: "system", content: "system" },
      { role: "user", content: "user prompt" },
    ])
    expect(body.response_format).toEqual({ type: "json_object" })
  })

  it("throws a descriptive error on a non-OK response", async () => {
    mockFetchOnce({ ok: false, status: 500 })
    await expect(generateTextWithNvidia({ prompt: "hi" })).rejects.toThrow(
      /NVIDIA NIM API error \(500\)/
    )
  })

  it("throws when the response has no content", async () => {
    mockFetchOnce({ ok: true, status: 200, json: () => Promise.resolve({ choices: [] }) })
    await expect(generateTextWithNvidia({ prompt: "hi" })).rejects.toThrow(
      /No content generated/
    )
  })
})
