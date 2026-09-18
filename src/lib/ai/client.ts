import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAIEnv } from "@/lib/ai/env";
import { DEFAULT_TIMEOUT_MS, TRANSPORT_MAX_RETRIES } from "@/lib/ai/config";

let cached: Anthropic | null = null;

/** Constructed lazily, same reasoning as getAIEnv() — see that file. */
export function getAIClient(): Anthropic {
  if (cached) return cached;

  const { ANTHROPIC_API_KEY } = getAIEnv();
  cached = new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
    timeout: DEFAULT_TIMEOUT_MS,
    // Handles network errors, 429s, and 5xxs with backoff at the
    // transport level — the SDK's own retry, distinct from
    // STRUCTURED_OUTPUT_RETRY_ATTEMPTS in config.ts, which is an
    // application-level retry for a failure the transport layer can't
    // see (a malformed structured response).
    maxRetries: TRANSPORT_MAX_RETRIES,
  });
  return cached;
}
