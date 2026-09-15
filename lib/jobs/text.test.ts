import { describe, expect, it } from "vitest"

import { htmlToPlainText, truncateForPrompt } from "@/lib/jobs/text"

describe("htmlToPlainText", () => {
  it("decodes Greenhouse's entity-escaped HTML into plain text", () => {
    // Shape taken from a real boards-api.greenhouse.io response (Discord's
    // board, 2026-09-15): the description arrives as escaped HTML.
    const greenhouse =
      "&lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;Discord has a highly engaged community, but there&#39;s one thing nearly everyone does: &lt;strong&gt;play video games.&lt;/strong&gt;&lt;/p&gt;&lt;/div&gt;"

    expect(htmlToPlainText(greenhouse)).toBe(
      "Discord has a highly engaged community, but there's one thing nearly everyone does: play video games."
    )
  })

  it("keeps block elements on separate lines instead of running sentences together", () => {
    expect(
      htmlToPlainText("<h2>Requirements</h2><ul><li>5+ years Go</li><li>Remote OK</li></ul>")
    ).toBe("Requirements\n5+ years Go\nRemote OK")
  })

  it("decodes entities that were inside the text itself", () => {
    expect(htmlToPlainText("&lt;p&gt;R&amp;amp;D &amp;gt; 3 years&lt;/p&gt;")).toBe("R&D > 3 years")
  })

  it("drops script and style contents entirely", () => {
    expect(htmlToPlainText("<style>.a{}</style><p>Hi</p><script>alert(1)</script>")).toBe("Hi")
  })

  it("passes plain text through unchanged", () => {
    expect(htmlToPlainText("Full-time, fully remote.")).toBe("Full-time, fully remote.")
  })
})

describe("truncateForPrompt", () => {
  it("leaves short text alone", () => {
    expect(truncateForPrompt("short", 100)).toBe("short")
  })

  it("cuts long text at a word boundary and marks the cut", () => {
    const result = truncateForPrompt("alpha beta gamma delta", 16)
    expect(result).toBe("alpha beta gamma…")
    expect(result.length).toBeLessThanOrEqual(17)
  })
})
