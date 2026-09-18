"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyLetterButton({ content }: { content: string }) {
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
    <Button type="button" variant="outline" onClick={handleCopy}>
      {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : "Copy text"}
    </Button>
  );
}
