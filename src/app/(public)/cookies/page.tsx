import { LegalPage } from "@/components/legal/legal-page";
import { cookiePolicy } from "@/config/legal";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: cookiePolicy.title,
  description: cookiePolicy.intro,
  path: "/cookies",
});

export default function CookiesPage() {
  return <LegalPage document={cookiePolicy} />;
}
