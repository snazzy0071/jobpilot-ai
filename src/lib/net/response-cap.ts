import "server-only";

/**
 * Reads a `Response` body with a hard byte cap, returning `null` if the
 * body exceeds it — the stream is cancelled the moment the cap is
 * crossed rather than buffered unconditionally into memory first and
 * checked after. Shared by every server-side fetcher in this app that
 * needs to bound a third-party response's size (src/lib/net/safe-fetch.ts,
 * the job-source adapters, the voice providers) instead of each one
 * hand-rolling its own streaming reader.
 */
export async function readResponseWithCap(response: Response, maxBytes: number): Promise<Buffer | null> {
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.byteLength > maxBytes ? null : buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

/**
 * The upfront, defense-in-depth half of the same check — a `Content-Length`
 * header can be absent or lie, so this never replaces
 * `readResponseWithCap`, but it lets an obviously-oversized response be
 * rejected before spending any time reading it at all.
 */
export function exceedsDeclaredLength(response: Response, maxBytes: number): boolean {
  const declared = response.headers.get("content-length");
  return declared != null && Number(declared) > maxBytes;
}
