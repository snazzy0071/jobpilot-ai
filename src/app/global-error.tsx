"use client";

import { useEffect } from "react";

/** Only shown if the root layout itself fails: it has to bring its own <html>, and uses no app styling or components. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("The app failed to render:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0, padding: 24, textAlign: "center" }}>
        <div role="alert" style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 22 }}>Something went wrong</h1>
          <p style={{ color: "#555" }}>The page couldn&apos;t be shown. Nothing you saved has been lost.</p>
          {error.digest && <p style={{ color: "#777", fontSize: 12 }}>Reference: {error.digest}</p>}
          <button onClick={reset} style={{ padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
