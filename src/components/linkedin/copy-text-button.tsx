"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Copies rewritten text so it can be pasted back into LinkedIn by hand — there's no LinkedIn API integration to "apply" it directly. Mirrors src/components/cover-letters/copy-letter-button.tsx's same small pattern. */
export function CopyTextButton({ content, label = "Copy" }: { content: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser — the text is
      // already visible on the page for a manual select-and-copy.
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
      {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : label}
    </Button>
  );
}
