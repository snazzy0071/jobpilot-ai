import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { buildDataExportPayload, buildDataExportZip } from "@/lib/settings/data-export";
import { logDataExportRequest } from "@/lib/settings/data-export-log";
import { siteConfig } from "@/config/site";

/**
 * `?format=zip` for the portable multi-file form, plain JSON otherwise
 * (the default, and the only option before this task) — both draw from
 * the exact same buildDataExportPayload(), so the two formats can never
 * drift apart on *what* gets exported, only how it's packaged.
 */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  const format = request.nextUrl.searchParams.get("format") === "zip" ? "zip" : "json";

  const payload = await buildDataExportPayload(user);

  // Logged after the data is already in hand but before the response is
  // sent — this is a request that's definitely about to succeed, and a
  // logging hiccup (best-effort inside logDataExportRequest itself) must
  // never block or fail the actual export.
  await logDataExportRequest(user.id, format);

  const filenameSlug = siteConfig.name.toLowerCase().replace(/\s+/g, "-");

  if (format === "zip") {
    const zipBuffer = await buildDataExportZip(payload);
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filenameSlug}-data-export.zip"`,
      },
    });
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filenameSlug}-data-export.json"`,
    },
  });
}
