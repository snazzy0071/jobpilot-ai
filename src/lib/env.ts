import { z } from "zod";

/**
 * Public (NEXT_PUBLIC_*) env vars only — this module is safe to import
 * from Client Components. Never add a secret here; put it in
 * `env.server.ts` instead, which is guarded against browser bundling.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("must be a valid URL, e.g. https://xyz.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "is required"),
  NEXT_PUBLIC_SITE_URL: z.url("must be a valid URL, e.g. http://localhost:3000"),
});

function loadPublicEnv() {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
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

export const publicEnv = loadPublicEnv();
