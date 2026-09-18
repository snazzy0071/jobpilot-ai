import "server-only";
import { z } from "zod";

/**
 * Same lazy-validation pattern as
 * src/lib/jobs/adapters/adzuna/env.ts — see that file's own comment for
 * why this isn't validated eagerly at module load.
 */
const reedEnvSchema = z.object({
  REED_API_KEY: z.string().min(1, "is required"),
});

export type ReedEnv = z.infer<typeof reedEnvSchema>;

let cached: ReedEnv | null = null;

/** Throws a plain Error (not a build-time crash) if Reed isn't configured. */
export function getReedEnv(): ReedEnv {
  if (cached) return cached;

  const parsed = reedEnvSchema.safeParse({
    REED_API_KEY: process.env.REED_API_KEY,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Reed isn't configured (see .env.example):\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
