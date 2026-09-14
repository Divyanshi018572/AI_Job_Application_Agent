import { describe, expect, it } from "vitest"

import {
  ALLOWED_AVATAR_TYPES,
  ALLOWED_RESUME_TYPES,
  detectFileType,
  isAllowedType,
} from "@/lib/security/file-validation"

describe("detectFileType", () => {
  it("detects PNG from its magic bytes regardless of claimed extension", () => {
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ])
    expect(detectFileType(pngHeader)).toBe("image/png")
  })

  it("detects JPEG from its magic bytes", () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    expect(detectFileType(jpegHeader)).toBe("image/jpeg")
  })

  it("detects GIF87a and GIF89a", () => {
    expect(detectFileType(Buffer.from("GIF87a", "ascii"))).toBe("image/gif")
    expect(detectFileType(Buffer.from("GIF89a", "ascii"))).toBe("image/gif")
  })

  it("detects WEBP (RIFF....WEBP)", () => {
    const webp = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from("WEBP", "ascii"),
    ])
    expect(detectFileType(webp)).toBe("image/webp")
  })

  it("detects PDF from the %PDF header", () => {
    const pdf = Buffer.from("%PDF-1.4\n%...", "ascii")
    expect(detectFileType(pdf)).toBe("application/pdf")
  })

  it("falls back to text/plain for clean printable content", () => {
    const text = Buffer.from("John Doe\nSoftware Engineer\nSkills: TS, SQL", "utf-8")
    expect(detectFileType(text)).toBe("text/plain")
  })

  it("rejects a file whose content doesn't match any known signature or look like text", () => {
    // Binary garbage with NUL bytes and control characters — not a real
    // image/PDF signature, and not plausible plain text either.
    const garbage = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06])
    expect(detectFileType(garbage)).toBeNull()
  })

  it("does not classify an SVG (no binary signature) as an allowed image type", () => {
    // This is the concrete stored-XSS scenario from AUDIT_AND_ROADMAP.md
    // Flaw 5: an SVG with an inline <script> claiming to be "image/svg+xml"
    // must never be accepted by the avatar upload allowlist.
    const maliciousSvg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      "utf-8"
    )
    const detected = detectFileType(maliciousSvg)
    expect(isAllowedType(detected, ALLOWED_AVATAR_TYPES)).toBe(false)
  })
})

describe("isAllowedType", () => {
  it("accepts a detected type present in the allowlist", () => {
    expect(isAllowedType("image/png", ALLOWED_AVATAR_TYPES)).toBe(true)
    expect(isAllowedType("application/pdf", ALLOWED_RESUME_TYPES)).toBe(true)
  })

  it("rejects null (undetected) and out-of-allowlist types", () => {
    expect(isAllowedType(null, ALLOWED_AVATAR_TYPES)).toBe(false)
    expect(isAllowedType("application/pdf", ALLOWED_AVATAR_TYPES)).toBe(false)
    expect(isAllowedType("image/png", ALLOWED_RESUME_TYPES)).toBe(false)
  })
})
