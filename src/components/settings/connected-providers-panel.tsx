"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { unlinkProvider, type SettingsResult } from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/settings/form-message";

const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "linkedin_oidc", label: "LinkedIn" },
  { id: "apple", label: "Apple" },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];
type Identity = { identity_id: string; provider: string };

export function ConnectedProvidersPanel({
  identities,
  totalIdentityCount,
}: {
  identities: Identity[];
  totalIdentityCount: number;
}) {
  const supabase = createClient();
  const [connecting, setConnecting] = useState<ProviderId | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const canDisconnect = totalIdentityCount > 1;

  async function handleConnect(provider: ProviderId) {
    setConnectError(null);
    setConnecting(provider);

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", "/dashboard/settings?tab=account");

    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: callbackUrl.toString() },
    });

    if (error) {
      setConnectError(error.message);
      setConnecting(null);
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-3">
      <p className="text-sm font-medium">Connected login providers</p>
      {PROVIDERS.map((provider) => {
        const identity = identities.find((candidate) => candidate.provider === provider.id);
        return (
          <div
            key={provider.id}
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div>
              <p className="text-sm font-medium">{provider.label}</p>
              <p className="text-xs text-muted-foreground">
                {identity ? "Connected" : "Not connected"}
              </p>
            </div>
            {identity ? (
              <DisconnectButton identityId={identity.identity_id} disabled={!canDisconnect} />
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={connecting !== null}
                onClick={() => handleConnect(provider.id)}
              >
                {connecting === provider.id ? "Connecting..." : "Connect"}
              </Button>
            )}
          </div>
        );
      })}
      {connectError && <p className="text-sm text-destructive">{connectError}</p>}
    </div>
  );
}

function DisconnectButton({ identityId, disabled }: { identityId: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState<SettingsResult, FormData>(
    unlinkProvider,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="identityId" value={identityId} />
      <Button type="submit" variant="outline" size="sm" disabled={disabled || pending}>
        {pending ? "Disconnecting..." : "Disconnect"}
      </Button>
      {disabled && <p className="text-xs text-muted-foreground">Your only sign-in method</p>}
      <FormMessage state={state} />
    </form>
  );
}
