import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

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
          // See opengraph-image.tsx's own comment — same literal-hex
          // constraint (Satori can't resolve CSS vars/oklch()), kept in
          // step with globals.css's tokens by hand.
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
