import { LegalPage } from "@/components/legal/legal-page";
import { accessibilityStatement } from "@/config/legal";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: accessibilityStatement.title,
  description: accessibilityStatement.intro,
  path: "/accessibility",
});

export default function AccessibilityPage() {
  return <LegalPage document={accessibilityStatement} />;
}
