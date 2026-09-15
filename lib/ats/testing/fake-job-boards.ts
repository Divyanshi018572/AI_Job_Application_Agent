import { vi } from "vitest"

/**
 * Test helper: stubs global fetch with the three public job-board APIs the
 * adapters call, for a given set of boards keyed "platform:token". Unknown
 * boards answer 404, like the real APIs. Discovery calls two different
 * endpoints per board (its name, then its jobs), so one blanket mock
 * response can't stand in for a board.
 */
export interface FakeBoard {
  /** The company name the board displays. */
  name: string
  /** How many open jobs it lists. */
  jobs: number
}

function response(status: number, body: unknown, text?: string) {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(text ?? JSON.stringify(body)),
  }
}

export function stubJobBoards(boards: Record<string, FakeBoard>) {
  const fetchMock = vi.fn(async (input: string | URL) => {
    const url = new URL(String(input))
    const seg = url.pathname.split("/").filter(Boolean).map(decodeURIComponent)

    let key: string | undefined
    let kind: "gh-board" | "gh-jobs" | "lever-jobs" | "lever-page" | "workable" | undefined
    if (url.hostname === "boards-api.greenhouse.io" && seg[1] === "boards") {
      key = `greenhouse:${seg[2]}`
      kind = seg[3] === "jobs" ? "gh-jobs" : "gh-board"
    } else if (url.hostname === "api.lever.co") {
      key = `lever:${seg[2]}`
      kind = "lever-jobs"
    } else if (url.hostname === "jobs.lever.co") {
      key = `lever:${seg[0]}`
      kind = "lever-page"
    } else if (url.hostname === "apply.workable.com" && seg[3] === "accounts") {
      key = `workable:${seg[4]}`
      kind = "workable"
    }

    const board = key ? boards[key] : undefined
    if (!board || !kind) return response(404, {})

    const token = key!.split(":")[1]
    const ids = Array.from({ length: board.jobs }, (_, i) => i + 1)
    switch (kind) {
      case "gh-board":
        return response(200, { name: board.name, content: "" })
      case "gh-jobs":
        return response(200, {
          jobs: ids.map((id) => ({ id, title: `Job ${id}`, absolute_url: `https://boards.greenhouse.io/${token}/jobs/${id}` })),
        })
      case "lever-jobs":
        return response(200, ids.map((id) => ({ id: String(id), text: `Job ${id}`, hostedUrl: `https://jobs.lever.co/${token}/${id}` })))
      case "lever-page":
        return response(200, {}, `<html><head><title>${board.name}</title></head></html>`)
      case "workable":
        return response(200, {
          name: board.name,
          jobs: ids.map((id) => ({ shortcode: `J${id}`, title: `Job ${id}`, url: `https://apply.workable.com/${token}/j/J${id}` })),
        })
    }
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}
