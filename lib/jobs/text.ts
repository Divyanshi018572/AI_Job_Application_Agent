const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1] === "x" || entity[1] === "X"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match
  })
}

/**
 * Turns a job description into plain text for the classification prompt.
 *
 * Greenhouse returns descriptions as *entity-escaped* HTML
 * (`&lt;p&gt;Hello&lt;/p&gt;`), about 8.7 KB per posting on real boards —
 * mostly markup the model would pay tokens to read and ignore. So: decode
 * once to recover the HTML, drop tags (block-level ones become line
 * breaks so sentences don't run together), decode again for entities that
 * were inside the text, and collapse whitespace.
 */
export function htmlToPlainText(input: string): string {
  const html = decodeEntities(input)
  const withoutTags = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/?(p|div|br|li|ul|ol|h[1-6]|tr|section)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")

  return decodeEntities(withoutTags)
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n[\s]*/g, "\n")
    .trim()
}

/**
 * Caps prompt text at `maxChars`, cutting at the last whitespace so a word
 * isn't split mid-way. Requirements like "5+ years of experience" usually
 * sit well inside the first few thousand characters of a posting.
 */
export function truncateForPrompt(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const cut = text.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(" ")
  return `${lastSpace > maxChars * 0.8 ? cut.slice(0, lastSpace) : cut}…`
}
