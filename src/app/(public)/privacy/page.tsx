import { LegalPage } from "@/components/legal/legal-page";
import { privacyPolicy } from "@/config/legal";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: privacyPolicy.title,
  description: privacyPolicy.intro,
  path: "/privacy",
});

export default function PrivacyPage() {
  return <LegalPage document={privacyPolicy} />;
}
