"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCvPreview } from "@/components/cvs/editor/preview-context";
import { useCvSaves } from "@/components/cvs/editor/save-coordinator";

function filenameFrom(disposition: string | null): string {
  const match = disposition ? /filename="([^"]+)"/.exec(disposition) : null;
  return match?.[1] ?? "CV.pdf";
}

/**
 * The one PDF export control (header and preview tab). Exporting is a
 * three-step guarantee rather than a bare link:
 *
 * 1. Everything pending is saved first (`flushAll`: every autosaving form
 *    and the template save). The PDF is drawn from the database, so
 *    exporting while an edit or a template change was still unsaved used
 *    to give a PDF that didn't match the preview.
 * 2. The request names the template the preview is showing; the server
 *    refuses (409) if the database has a different one.
 * 3. The response says which template it actually rendered, and it is
 *    checked against the preview before the file is handed over.
 *
 * Any failure is shown next to the button — a failed export never turns
 * into a blank tab or a silently wrong file.
 */
export function ExportPdfButton({
  cvId,
  variant = "outline",
  size = "sm",
  label = "PDF",
}: {
  cvId: string;
  variant?: "outline" | "default";
  size?: "sm" | "default";
  label?: string;
}) {
  const { preview } = useCvPreview();
  const { flushAll } = useCvSaves();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const templateRef = useRef(preview.template);
  useEffect(() => {
    templateRef.current = preview.template;
  });

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const flushed = await flushAll();
      if (flushed) {
        setError(`Your changes aren't saved yet, so the PDF wasn't created: ${flushed.error}`);
        return;
      }

      const template = templateRef.current;
      const response = await fetch(`/api/cvs/${cvId}/export?template=${encodeURIComponent(template)}`, {
        credentials: "same-origin",
        cache: "no-store",
        // Generation is bounded server-side (60s); never leave the button spinning forever if the request stalls.
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) {
        let message = "Couldn't generate that PDF. Try again.";
        try {
          const body = (await response.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          /* not JSON — keep the generic message */
        }
        setError(message);
        return;
      }

      const rendered = response.headers.get("X-Cv-Template");
      if (rendered && rendered !== template) {
        setError("The PDF was drawn with a different template than your preview, so it wasn't downloaded. Try again.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFrom(response.headers.get("Content-Disposition"));
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      setError(
        error instanceof DOMException && error.name === "TimeoutError"
          ? "Creating the PDF took too long. Try again in a moment."
          : "Couldn't reach the server to create the PDF. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant={variant} size={size} onClick={handleExport} disabled={busy}>
        {busy ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />} {label}
      </Button>
      {error && (
        <span role="alert" className="max-w-64 text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
