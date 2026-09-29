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
          // in step with globals.css's `section-dark` band (deep blue-
          // black) and --primary (#1D4ED8) by hand.
          backgroundColor: "#0f1b33",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 108, fontWeight: 700, letterSpacing: -3, color: "#60a5fa" }}>{siteConfig.name}</div>
        <div style={{ fontSize: 34, color: "#bfdbfe", marginTop: 20 }}>
          The UK career toolkit
        </div>
      </div>
    ),
    { ...size },
  );
}
