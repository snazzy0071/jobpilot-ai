"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "linkedin_oidc", label: "LinkedIn" },
  { id: "apple", label: "Apple" },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

export function OAuthButtons({ redirectTo, schemeSlug }: { redirectTo?: string; schemeSlug?: string }) {
  const supabase = createClient();
  const [pendingProvider, setPendingProvider] = useState<ProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOAuth(provider: ProviderId) {
    setError(null);
    setPendingProvider(provider);

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    if (redirectTo) callbackUrl.searchParams.set("next", redirectTo);
    if (schemeSlug) {
      callbackUrl.searchParams.set("from", "grad");
      callbackUrl.searchParams.set("scheme", schemeSlug);
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

    // On success the browser is already navigating away; we only ever
    // reach here on failure (e.g. the provider isn't configured yet).
    if (oauthError) {
      setError(oauthError.message);
      setPendingProvider(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        {PROVIDERS.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            variant="outline"
            disabled={pendingProvider !== null}
            aria-busy={pendingProvider === provider.id}
            onClick={() => handleOAuth(provider.id)}
          >
            {pendingProvider === provider.id ? "..." : provider.label}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
