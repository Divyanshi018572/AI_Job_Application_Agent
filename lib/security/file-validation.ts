/**
 * File-content validation via magic bytes.
 *
 * Client-supplied `file.type` / filename extensions are trivially spoofable —
 * never trust them alone for anything that gets stored and later served back
 * to a browser. See SECURITY.md Section 3 for the rule this file enforces.
 */

export type DetectedFileType =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp"
  | "application/pdf"
  | "text/plain"
  | null

function bytesStartWith(buf: Buffer, sig: number[], offset = 0): boolean {
  if (buf.length < offset + sig.length) return false
  for (let i = 0; i < sig.length; i++) {
    if (buf[offset + i] !== sig[i]) return false
  }
  return true
}

/**
 * Sniffs the real type of a buffer from its magic bytes. Returns null when
 * the content doesn't match any allowed signature — callers should reject
 * the upload in that case rather than falling back to the client-supplied
 * content type.
 */
export function detectFileType(buf: Buffer): DetectedFileType {
  if (bytesStartWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png"
  }
  if (bytesStartWith(buf, [0xff, 0xd8, 0xff])) {
    return "image/jpeg"
  }
  if (
    bytesStartWith(buf, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    bytesStartWith(buf, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return "image/gif"
  }
  if (
    bytesStartWith(buf, [0x52, 0x49, 0x46, 0x46]) &&
    bytesStartWith(buf, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp"
  }
  if (bytesStartWith(buf, [0x25, 0x50, 0x44, 0x46])) {
    // "%PDF"
    return "application/pdf"
  }

  // Plain text: allow only if the first 1KB is free of NUL bytes and other
  // control characters that would indicate a binary/script payload wearing
  // a .txt extension.
  const sample = buf.subarray(0, Math.min(buf.length, 1024))
  const looksLikeText = sample.every(
    (byte) => byte === 0x09 || byte === 0x0a || byte === 0x0d || byte >= 0x20
  )
  if (looksLikeText && sample.length > 0) {
    return "text/plain"
  }

  return null
}

export const ALLOWED_AVATAR_TYPES: DetectedFileType[] = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]

export const ALLOWED_RESUME_TYPES: DetectedFileType[] = [
  "application/pdf",
  "text/plain",
]

export function isAllowedType(
  detected: DetectedFileType,
  allowed: DetectedFileType[]
): detected is Exclude<DetectedFileType, null> {
  return detected !== null && allowed.includes(detected)
}
