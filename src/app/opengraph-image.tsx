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
          // next/og's renderer, can't resolve `var(...)`) — kept in step
          // with globals.css's light brand palette (--primary #3350ff,
          // cyan and coral accents) by hand.
          backgroundColor: "#fbfcff",
          backgroundImage:
            "radial-gradient(circle at 10% 10%, rgba(18,181,229,0.35), transparent 45%), radial-gradient(circle at 90% 15%, rgba(51,80,255,0.3), transparent 45%), radial-gradient(circle at 70% 100%, rgba(255,106,61,0.25), transparent 45%)",
          color: "#0f1a3d",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 108, fontWeight: 700, letterSpacing: -3, color: "#3350ff" }}>{siteConfig.name}</div>
        <div style={{ fontSize: 34, color: "#0f1a3d", marginTop: 20 }}>
          The UK career toolkit
        </div>
      </div>
    ),
    { ...size },
  );
}
