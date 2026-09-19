import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

// A real, dynamically-rendered OG image (no static asset to go stale or
// 404) — Next.js wires this up as the default og:image for every route
// that doesn't define its own opengraph-image file.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          // Literal hex, not the real CSS custom properties (Satori,
          // next/og's renderer, can't resolve `var(...)`/oklch()) — kept
          // in step with globals.css's dark-mode --background/--primary/
          // --muted-foreground by hand. A generic near-black/neutral-gray
          // pairing here was the actual "random color" this file had —
          // this is the same deep violet-black + brand purple everywhere
          // else in the app already uses.
          backgroundColor: "#15121f",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 108, fontWeight: 700, letterSpacing: -3, color: "#8f7bff" }}>{siteConfig.name}</div>
        <div style={{ fontSize: 34, color: "#b3a9d1", marginTop: 20 }}>
          The UK career toolkit
        </div>
      </div>
    ),
    { ...size },
  );
}
