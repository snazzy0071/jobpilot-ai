import "server-only";
import { z } from "zod";

/**
 * Validated lazily, like src/lib/stripe/env.ts, and for the same
 * reason: an eager throw at module load (src/lib/env.server.ts's
 * pattern) would fail `next build` itself the moment any page's bundle
 * references the AI service, not just fail at the point someone
 * actually tries to use it. ANTHROPIC_API_KEY isn't set in this
 * environment — getAIEnv() is only called at the point of use, so the
 * build stays green regardless.
 */
const aiEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "is required"),
});

export type AIEnv = z.infer<typeof aiEnvSchema>;

let cached: AIEnv | null = null;

export function getAIEnv(): AIEnv {
  if (cached) return cached;

  const parsed = aiEnvSchema.safeParse({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`AI service isn't configured (see .env.example):\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
