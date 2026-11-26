// You Paid staging evidence upload policy. STAGING ONLY. Pure logic, no I/O. Fails closed.
// A file accepted here is only QUARANTINED: never scanned, approved, released or shown to anyone.

export const EVIDENCE_BUCKET = "you-paid-work-evidence";
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // matches the bucket file_size_limit (10 MiB)
export const MIN_UPLOAD_BYTES = 64;
export const UPLOAD_SCOPE = "upload_synthetic_evidence";
export const ALLOWED_CONTENT_TYPE = "application/pdf";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
// PDF features that can execute, launch, or carry nested payloads. Fictional staging evidence never needs them.
const ACTIVE_PDF_MARKERS = ["/JavaScript", "/JS", "/Launch", "/EmbeddedFile", "/OpenAction", "/AA", "/RichMedia", "/XFA", "/SubmitForm", "/ImportData"];

export type Check = { ok: true } | { ok: false; status: number; reason: string };

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

/** Server-owned storage path. The client never chooses it. Shape matches the scanner's path guard. */
export function objectPathFor(userId: string, artifactId: string): string {
  if (!isUuid(userId) || !isUuid(artifactId)) throw new Error("invalid_path_components");
  return `${userId.toLowerCase()}/${artifactId.toLowerCase()}.pdf`;
}

export function storageReferenceFor(objectPath: string): string {
  return `${EVIDENCE_BUCKET}/${objectPath}`;
}

/** Validate request headers before reading the body. */
export function checkHeaders(h: { contentType: string | null; contentLength: string | null; employmentId: string | null }): Check {
  const ct = (h.contentType || "").split(";")[0].trim().toLowerCase();
  if (ct !== ALLOWED_CONTENT_TYPE) return { ok: false, status: 415, reason: "pdf_only" };
  if (!isUuid(h.employmentId)) return { ok: false, status: 400, reason: "employment_id_required" };
  if (h.contentLength !== null) {
    const n = Number(h.contentLength);
    if (!Number.isFinite(n) || n < 0) return { ok: false, status: 400, reason: "invalid_content_length" };
    if (n > MAX_UPLOAD_BYTES) return { ok: false, status: 413, reason: "file_too_large" };
  }
  return { ok: true };
}

/** Validate the actual bytes: size, PDF magic, trailer, and absence of active-content markers. */
export function checkPdfBytes(bytes: Uint8Array): Check {
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, status: 413, reason: "file_too_large" };
  if (bytes.length < MIN_UPLOAD_BYTES) return { ok: false, status: 422, reason: "file_too_small" };
  if (!PDF_MAGIC.every((b, i) => bytes[i] === b)) return { ok: false, status: 422, reason: "not_a_pdf" };
  // Latin-1 decoding maps every byte 1:1, so marker search cannot be dodged with invalid UTF-8.
  const text = new TextDecoder("latin1").decode(bytes);
  if (!text.slice(-1024).includes("%%EOF")) return { ok: false, status: 422, reason: "pdf_truncated" };
  // Match a marker only when it is a complete PDF name (next char is not a regular name character).
  for (const m of ACTIVE_PDF_MARKERS) {
    const re = new RegExp(m.replace("/", "\\/") + "(?![A-Za-z0-9#])");
    if (re.test(text)) return { ok: false, status: 422, reason: "pdf_active_content_rejected" };
  }
  // Hex-escaped names (e.g. /J#61vaScript) are a classic evasion; refuse any escaped name outright.
  if (/\/[A-Za-z0-9]*#[0-9A-Fa-f]{2}/.test(text)) return { ok: false, status: 422, reason: "pdf_obfuscated_names_rejected" };
  return { ok: true };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Read a request body while enforcing the byte limit as it streams (Content-Length is untrusted). */
export async function readBounded(body: ReadableStream<Uint8Array> | null, max: number): Promise<Uint8Array | null> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) { await reader.cancel().catch(() => {}); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

/**
 * Consume (and discard) up to `max` bytes of a request body, then cancel the rest.
 * The Supabase gateway does not deliver a response until the request body has been read, so every early
 * rejection must drain the body first; otherwise a client sending > ~0.5 MiB hangs until timeout.
 * Never throws. Returns the number of bytes discarded.
 */
export async function drainBody(body: ReadableStream<Uint8Array> | null, max: number): Promise<number> {
  if (!body) return 0;
  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try { reader = body.getReader(); } catch { return 0; }
  let total = 0;
  try {
    while (total <= max) {
      const { done, value } = await reader.read();
      if (done) return total;
      total += value.byteLength;
    }
    await reader.cancel().catch(() => {});
    return total;
  } catch {
    return total;
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}
