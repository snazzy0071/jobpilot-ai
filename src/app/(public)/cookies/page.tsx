import { LegalPage } from "@/components/legal/legal-page";
import { cookiePolicy } from "@/config/legal";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: cookiePolicy.title,
  description: "How JobPilot AI uses cookies: every cookie we set is strictly necessary, we use no analytics or advertising cookies, and you can review your choice at any time.",
  path: "/cookies",
});

export default function CookiesPage() {
  return <LegalPage document={cookiePolicy} />;
}
