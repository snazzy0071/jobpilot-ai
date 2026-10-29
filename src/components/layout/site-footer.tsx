import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Container } from "@/components/marketing/container";
import { Logo } from "@/components/layout/logo";
import { CookiePreferencesLink } from "@/components/consent/cookie-preferences-link";
import {
  COMPANY_LINKS,
  FEATURE_LINKS,
  INSTITUTION_LINKS,
  LEGAL_LINKS,
  VISA_LINKS,
  type NavLink,
} from "@/config/public-nav";

const SOCIAL_LINKS = [
  { href: siteConfig.social.linkedin, label: "LinkedIn" },
  { href: siteConfig.social.x, label: "X" },
  { href: siteConfig.social.instagram, label: "Instagram" },
  { href: siteConfig.social.tiktok, label: "TikTok" },
];

const COLUMNS: { title: string; links: NavLink[] }[] = [
  { title: "Product", links: FEATURE_LINKS },
  { title: "Visa & sponsorship", links: VISA_LINKS },
  { title: "Company", links: COMPANY_LINKS },
  { title: "Institutions", links: INSTITUTION_LINKS },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-linear-to-b from-background to-[#eef2ff]">
      <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--gradient-vivid)] opacity-60" aria-hidden="true" />
      <div className="animate-blob pointer-events-none absolute -bottom-40 -left-24 size-96 bg-brand-cyan/15 blur-3xl" aria-hidden="true" />
      <div className="animate-blob pointer-events-none absolute -right-24 -bottom-40 size-96 bg-primary/10 blur-3xl [animation-delay:-9s]" aria-hidden="true" />
      <Container className="relative py-16">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
        <div className="flex max-w-sm flex-col gap-4">
          <Logo />
          <p className="text-sm text-muted-foreground">
            The UK career toolkit for students and graduates: a UK-standard CV, an honest ATS score and real visa sponsor
            data, in one place.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {COLUMNS.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide text-foreground uppercase">
                {column.title}
              </p>
              <nav aria-label={column.title} className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="w-fit text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t pt-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <p>
              &copy; {new Date().getFullYear()} {siteConfig.company}. All rights reserved.
              {" · "}
              <a href={`mailto:${siteConfig.supportEmail}`} className="hover:text-foreground">
                {siteConfig.supportEmail}
              </a>
            </p>
          </div>

          <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-4">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-foreground">
                {link.label}
              </Link>
            ))}
            <CookiePreferencesLink className="hover:text-foreground" />
          </nav>

          <nav aria-label="Social" className="flex items-center gap-4">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
