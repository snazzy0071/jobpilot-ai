import "server-only";
import { fetch as undiciFetch, Agent } from "undici";
import ipaddr from "ipaddr.js";
import { createSsrfSafeLookup, isPublicAddress } from "@/lib/net/ip-guard";
import { readResponseWithCap, exceedsDeclaredLength } from "@/lib/net/response-cap";
import { siteConfig } from "@/config/site";

const FETCH_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

export type SafeFetchResult = { error: string } | { html: string; finalUrl: string };

/**
 * `new URL(...)`'s own `.hostname` getter always returns an IPv6
 * literal bracketed (`[::1]`, not `::1`) — every alternate IPv4 encoding
 * (decimal, hex, octal, short form) is already canonicalized to plain
 * dotted-quad by the URL parser itself, but brackets on an IPv6 literal
 * are not something `ipaddr.js` accepts (`ipaddr.isValid("[::1]")` is
 * `false`, `ipaddr.isValid("::1")` is `true`), so this is required
 * before any IP-literal check below runs against one.
 */
function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

/**
 * Fast, cheap pre-flight checks that reject an obviously-unsafe URL
 * before any network attempt at all (scheme, embedded credentials, a
 * literal private IP) — real enforcement against DNS rebinding for a
 * *hostname* target still happens per-connection in ip-guard.ts's
 * lookup, which every hostname-based request this function makes
 * (including redirect hops, followed by the same Agent) goes through.
 *
 * For an IP-*literal* target, though, this upfront check is the only
 * enforcement, not just the fast path — confirmed directly against this
 * app's actual undici version: an Agent's custom `lookup` is only ever
 * invoked to resolve a *hostname*, never called at all when the URL's
 * host is already a literal IP address (nothing to resolve), so
 * ip-guard.ts's lookup-based defense structurally cannot see or block
 * an IP literal. That's fine for rebinding specifically (a literal has
 * no resolution step for a rebinding attacker's DNS server to answer
 * differently at), but it does mean this function's literal-IP checks
 * below have to be complete on their own — including the bracket
 * handling above, which a previous version of this check didn't do,
 * silently letting `http://[::1]/`, `http://[fe80::1]/`, and
 * `http://[::ffff:127.0.0.1]/` (an IPv4-mapped loopback address) reach
 * the network unblocked.
 */
function validateUrlUpfront(rawUrl: string): { url: URL } | { error: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { error: "That doesn't look like a valid URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "Only http:// and https:// links are supported." };
  }
  if (url.username || url.password) {
    return { error: "That link isn't supported — remove any credentials from the URL." };
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return { error: "That link points to a local address, which isn't supported." };
  }
  const literalCandidate = stripIpv6Brackets(hostname);
  if (ipaddr.isValid(literalCandidate) && !isPublicAddress(literalCandidate)) {
    return { error: "That link points to a private or internal address, which isn't supported." };
  }

  return { url };
}

const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Server-only. Fetches a URL the way a browser would for a job-posting
 * page — GET, follow redirects, expect HTML — but every connection
 * (the initial request and every redirect hop, since they share the
 * same Agent) is DNS-resolved through ip-guard.ts's SSRF-safe lookup, a
 * time limit is enforced, and the response body is read with a hard
 * byte cap rather than buffered unconditionally. Never throws: every
 * failure — blocked address, timeout, non-HTML response, oversized body,
 * a real network/DNS error — comes back as a safe `{ error }` string a
 * caller can show directly, since none of them reveal anything about the
 * internal network the way a raw exception message might.
 */
export async function safeFetchHtml(rawUrl: string): Promise<SafeFetchResult> {
  const validated = validateUrlUpfront(rawUrl);
  if ("error" in validated) return validated;

  const agent = new Agent({ connect: { lookup: createSsrfSafeLookup() } });
  // One timeout for the whole operation, including every redirect hop —
  // created once, outside the loop below, so a chain of redirects each
  // finishing just under the limit can't add up to an unbounded total
  // wait. Redirects are followed manually (`redirect: "manual"`, not
  // "follow") specifically so each hop's target can be re-validated
  // through validateUrlUpfront before it's ever requested — undici's own
  // automatic redirect-following has no hook for that, and this is what
  // "block redirects to private networks" actually requires: a
  // same-looking public page that 302s to `http://[::1]/` or
  // `http://169.254.169.254/` must never be followed there, and the
  // per-connection SSRF-safe lookup alone doesn't catch an IP-literal
  // redirect target — see validateUrlUpfront's own doc comment for why.
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  try {
    let currentUrl = validated.url;
    let response: Response;

    for (let redirectCount = 0; ; redirectCount++) {
      try {
        response = (await undiciFetch(currentUrl, {
          dispatcher: agent,
          redirect: "manual",
          signal,
          headers: {
            "User-Agent": `${siteConfig.name.replace(/\s+/g, "")}Bot/1.0 (job posting import; +${siteConfig.domain})`,
            Accept: "text/html,application/xhtml+xml",
          },
        })) as unknown as Response;
      } catch (err) {
        console.error("safeFetchHtml request failed:", err);
        return { error: "Couldn't reach that page — it may be blocking automated requests, or the link may be down." };
      }

      if (!REDIRECT_STATUSES.has(response.status)) break;

      if (redirectCount >= MAX_REDIRECTS) {
        return { error: "That link redirected too many times." };
      }
      const location = response.headers.get("location");
      if (!location) {
        return { error: "That page redirected without a destination." };
      }

      let nextUrl: URL;
      try {
        nextUrl = new URL(location, currentUrl);
      } catch {
        return { error: "That page redirected to an address that couldn't be read." };
      }

      const revalidated = validateUrlUpfront(nextUrl.toString());
      if ("error" in revalidated) return revalidated;
      currentUrl = revalidated.url;
    }

    if (!response.ok) {
      return { error: `That page returned an error (${response.status}) — try pasting the job description instead.` };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!ALLOWED_CONTENT_TYPES.some((allowed) => contentType.includes(allowed))) {
      return { error: "That link doesn't point to a readable web page — try pasting the job description instead." };
    }

    if (exceedsDeclaredLength(response, MAX_RESPONSE_BYTES)) {
      return { error: "That page is too large to read." };
    }

    const body = await readResponseWithCap(response, MAX_RESPONSE_BYTES);
    if (body === null) {
      return { error: "That page is too large to read." };
    }

    return { html: body.toString("utf-8"), finalUrl: currentUrl.toString() };
  } finally {
    await agent.close();
  }
}
