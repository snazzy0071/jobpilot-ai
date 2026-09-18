// The one branded shell every outgoing email renders through —
// header (wordmark), body slot, standard footer. Plain HTML string
// templates, not JSX/react-email: every email in this app is already
// built this way (src/lib/quick-scan/send-report-email.ts,
// src/lib/applications/reminders/dispatch.ts,
// src/lib/institutions/admin/actions.ts), and introducing a second
// rendering technology for just the outer shell would leave two
// different ways to build an email in the same codebase. `siteConfig`
// is this app's own single source of brand identity (name, domain,
// support email) — nothing here hardcodes a brand string that already
// lives there.

import { siteConfig } from "@/config/site";
import { escapeHtml } from "@/lib/email/escape-html";

const BRAND_COLOR = "#6c47ff"; // globals.css's own light-mode --primary — the one place this app's real brand colour is defined; kept in sync by eye, not imported, since CSS custom properties aren't reachable from a plain-text email anyway.

/**
 * Wraps `bodyHtml` (built by the caller, e.g. with the block helpers
 * below) in the standard header/footer shell every email shares.
 * `previewText` is the line Gmail/Apple Mail show in the inbox list
 * before the email is opened — invisible in the rendered body itself,
 * hidden via zero-height/overflow rather than `display:none` alone,
 * which some clients ignore.
 */
export function renderEmailLayout(params: { previewText?: string; bodyHtml: string; footerNote?: string }): string {
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(siteConfig.name)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    ${
      params.previewText
        ? `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(params.previewText)}</div>`
        : ""
    }
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #e5e7eb;">
                <span style="font-size:18px;font-weight:700;color:${BRAND_COLOR};letter-spacing:-0.01em;">${escapeHtml(siteConfig.name)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${params.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #e5e7eb;background-color:#fafafa;">
                <p style="font-size:11px;color:#9ca3af;margin:0;line-height:1.6;">
                  ${escapeHtml(siteConfig.company)} ·
                  <a href="mailto:${escapeHtml(siteConfig.supportEmail)}" style="color:#9ca3af;">${escapeHtml(siteConfig.supportEmail)}</a>
                  ${params.footerNote ? `<br />${escapeHtml(params.footerNote)}` : ""}
                  <br />© ${year} ${escapeHtml(siteConfig.company)}. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Reusable inner-content blocks — every caller building `bodyHtml`
// above can compose from these instead of hand-rolling its own inline
// styles per email, which is how the three templates that predate this
// file each ended up with their own slightly different heading/button
// styling. Each one escapes its own text content.

export function emailHeading(text: string): string {
  return `<h1 style="font-size:20px;font-weight:600;margin:0 0 12px;color:#111827;">${escapeHtml(text)}</h1>`;
}

export function emailParagraph(text: string): string {
  return `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#374151;">${escapeHtml(text)}</p>`;
}

/**
 * `href` is defensively hardened even though every current caller
 * already passes an internally-constructed link (siteConfig.domain + a
 * known path, never raw user input) — escaped so an embedded `"`
 * can't break out of the attribute, and scheme-checked so a future
 * caller can't be tricked into emitting a `javascript:`/`data:` URI.
 * Anything that isn't a plain http(s) link becomes `#` rather than
 * silently dropping the button.
 */
export function emailButton(label: string, href: string): string {
  const safeHref = /^https?:\/\//i.test(href) ? href : "#";
  return `<p style="margin:24px 0 0;"><a href="${escapeHtml(safeHref)}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

export function emailSmallPrint(text: string): string {
  return `<p style="font-size:11px;color:#9ca3af;margin:24px 0 0;line-height:1.6;">${escapeHtml(text)}</p>`;
}
