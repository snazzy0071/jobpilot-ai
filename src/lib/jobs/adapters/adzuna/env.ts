import "server-only";
import { z } from "zod";

/**
 * Validated lazily, on demand — same reasoning as src/lib/stripe/env.ts
 * and src/lib/ai/env.ts: an eager throw at module load
 * (src/lib/env.server.ts's pattern) would fail `next build` itself in
 * any environment that hasn't configured Adzuna yet, not just the sync
 * itself. Call getAdzunaEnv() at the point of use and handle the throw
 * there.
 *
 * `import "server-only"` makes an accidental import from client code
 * fail the build instead of silently bundling these credentials into
 * the browser — the concrete mechanism behind "no direct client API
 * keys", not just a naming convention.
 */
const adzunaEnvSchema = z.object({
  ADZUNA_APP_ID: z.string().min(1, "is required"),
  ADZUNA_APP_KEY: z.string().min(1, "is required"),
});

export type AdzunaEnv = z.infer<typeof adzunaEnvSchema>;

let cached: AdzunaEnv | null = null;

/** Throws a plain Error (not a build-time crash) if Adzuna isn't configured. */
export function getAdzunaEnv(): AdzunaEnv {
  if (cached) return cached;

  const parsed = adzunaEnvSchema.safeParse({
    ADZUNA_APP_ID: process.env.ADZUNA_APP_ID,
    ADZUNA_APP_KEY: process.env.ADZUNA_APP_KEY,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Adzuna isn't configured (see .env.example):\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
