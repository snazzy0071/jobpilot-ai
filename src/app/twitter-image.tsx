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
          backgroundColor: "#0a0a0a",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 108, fontWeight: 700, letterSpacing: -3 }}>{siteConfig.name}</div>
        <div style={{ fontSize: 34, color: "#a1a1aa", marginTop: 20 }}>
          The UK career toolkit
        </div>
      </div>
    ),
    { ...size },
  );
}
