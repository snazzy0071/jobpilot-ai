import { LegalPage } from "@/components/legal/legal-page";
import { termsOfService } from "@/config/legal";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: termsOfService.title,
  description: termsOfService.intro,
  path: "/terms",
});

export default function TermsPage() {
  return <LegalPage document={termsOfService} />;
}
