import "server-only";
import { z } from "zod";

/**
 * Secret env vars only. The `server-only` import above makes any
 * accidental import of this module from client code fail the build,
 * instead of silently bundling a secret into the browser.
 */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "is required"),
});

function loadServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment variables (see .env.example):\n${issues}`,
    );
  }

  return parsed.data;
}

export const serverEnv = loadServerEnv();
