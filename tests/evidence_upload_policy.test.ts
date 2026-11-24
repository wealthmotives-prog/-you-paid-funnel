// Run: node --experimental-strip-types --test tests/evidence_upload_policy.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  checkHeaders, checkPdfBytes, MAX_UPLOAD_BYTES, objectPathFor, readBounded, sha256Hex, storageReferenceFor,
} from "../supabase/functions/_shared/evidence_upload_policy.ts";

const U = "11111111-1111-4111-8111-111111111111";
const ART = "33333333-3333-4333-8333-333333333333";
const EMP = "44444444-4444-4444-8444-444444444444";
const enc = (s: string) => new TextEncoder().encode(s);
// Minimal fictional single-page PDF; content is a fixed synthetic phrase.
export function fictionalPdf(extra = ""): Uint8Array {
  return enc(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]" + extra + ">>endobj\n" +
    "% FICTIONAL TEST DOCUMENT - NOT A REAL PERSON - YOU PAID STAGING\ntrailer<</Root 1 0 R>>\n%%EOF\n");
}

test("UP-01 server-owned path matches scanner guard shape", () => {
  const p = objectPathFor(U, ART);
  assert.equal(p, `${U}/${ART}.pdf`);
  assert.match(p, /^[0-9a-f-]{36}\/[a-zA-Z0-9_./-]+$/);
  assert.equal(p.includes(".."), false);
  assert.equal(storageReferenceFor(p), `you-paid-work-evidence/${p}`);
});
test("UP-02 path refuses non-UUID components (no traversal)", () => {
  assert.throws(() => objectPathFor("../etc", ART));
  assert.throws(() => objectPathFor(U, "x/../y"));
});
test("UP-03 header checks", () => {
  assert.deepEqual(checkHeaders({ contentType: "application/pdf", contentLength: "1000", employmentId: EMP }), { ok: true });
  assert.deepEqual(checkHeaders({ contentType: "application/pdf; charset=binary", contentLength: null, employmentId: EMP }), { ok: true });
  assert.deepEqual(checkHeaders({ contentType: "image/png", contentLength: "10", employmentId: EMP }), { ok: false, status: 415, reason: "pdf_only" });
  assert.deepEqual(checkHeaders({ contentType: null, contentLength: "10", employmentId: EMP }), { ok: false, status: 415, reason: "pdf_only" });
  assert.deepEqual(checkHeaders({ contentType: "application/pdf", contentLength: "10", employmentId: "nope" }), { ok: false, status: 400, reason: "employment_id_required" });
  assert.deepEqual(checkHeaders({ contentType: "application/pdf", contentLength: String(MAX_UPLOAD_BYTES + 1), employmentId: EMP }), { ok: false, status: 413, reason: "file_too_large" });
  assert.deepEqual(checkHeaders({ contentType: "application/pdf", contentLength: "-5", employmentId: EMP }), { ok: false, status: 400, reason: "invalid_content_length" });
});
test("UP-04 fictional PDF accepted", () => assert.deepEqual(checkPdfBytes(fictionalPdf()), { ok: true }));
test("UP-05 wrong magic (PNG renamed .pdf) rejected", () => {
  const png = new Uint8Array(200); png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(checkPdfBytes(png), { ok: false, status: 422, reason: "not_a_pdf" });
});
test("UP-06 too small / empty rejected", () => {
  assert.deepEqual(checkPdfBytes(new Uint8Array(0)), { ok: false, status: 422, reason: "file_too_small" });
  assert.deepEqual(checkPdfBytes(enc("%PDF-1.4\n%%EOF")), { ok: false, status: 422, reason: "file_too_small" });
});
test("UP-07 oversized rejected", () =>
  assert.deepEqual(checkPdfBytes(new Uint8Array(MAX_UPLOAD_BYTES + 1)), { ok: false, status: 413, reason: "file_too_large" }));
test("UP-08 truncated (no %%EOF) rejected", () => {
  const b = fictionalPdf(); const cut = b.slice(0, b.length - 8);
  assert.deepEqual(checkPdfBytes(cut), { ok: false, status: 422, reason: "pdf_truncated" });
});
test("UP-09 active content rejected", () => {
  for (const m of ["/JavaScript", "/JS", "/Launch", "/EmbeddedFile", "/OpenAction", "/AA", "/XFA", "/SubmitForm"]) {
    assert.deepEqual(checkPdfBytes(fictionalPdf(m + " 5 0 R")), { ok: false, status: 422, reason: "pdf_active_content_rejected" }, m);
  }
});
test("UP-10 hex-escaped name obfuscation rejected", () =>
  assert.deepEqual(checkPdfBytes(fictionalPdf("/J#61vaScript 5 0 R")), { ok: false, status: 422, reason: "pdf_obfuscated_names_rejected" }));
test("UP-11 marker-like but distinct names are not false positives", () => {
  assert.deepEqual(checkPdfBytes(fictionalPdf("/AAAAAB+Helvetica /JSONish 1")), { ok: true });
});
test("UP-12 sha256 matches node crypto", async () => {
  const b = fictionalPdf();
  assert.equal(await sha256Hex(b), createHash("sha256").update(b).digest("hex"));
});
test("UP-13 bounded reader stops past the limit", async () => {
  const big = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(600)); c.enqueue(new Uint8Array(600)); c.close(); } });
  assert.equal(await readBounded(big, 1000), null);
  const ok = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(300)); c.enqueue(new Uint8Array(200)); c.close(); } });
  assert.equal((await readBounded(ok, 1000))?.length, 500);
  assert.equal((await readBounded(null, 1000))?.length, 0);
});
