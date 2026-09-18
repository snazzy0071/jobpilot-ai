import "server-only";
import { z } from "zod";

/**
 * Resend env vars, validated on demand rather than at import time — same
 * reasoning as src/lib/ai/env.ts and src/lib/stripe/env.ts: this module
 * gets pulled into the build graph by any page that references Quick
 * Scan's report-email send, even in an environment where Resend isn't
 * configured yet. An eager throw at import time would fail `next build`
 * itself; call getEmailEnv() at the point of use instead.
 */
const emailEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1, "is required"),
  RESEND_FROM_EMAIL: z.email("must be a valid email address"),
});

export type EmailEnv = z.infer<typeof emailEnvSchema>;

let cached: EmailEnv | null = null;

/** Throws a plain Error (not a build-time crash) if Resend isn't configured. */
export function getEmailEnv(): EmailEnv {
  if (cached) return cached;

  const parsed = emailEnvSchema.safeParse({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Email sending isn't configured (see .env.example):\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
