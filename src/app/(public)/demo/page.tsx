import { BarChart3Icon, KeyRoundIcon, Mail, PresentationIcon } from "lucide-react";
import { SplitFormPage } from "@/components/marketing/split-form-page";
import { GradientText } from "@/components/marketing/gradient-text";
import { DemoRequestForm } from "@/components/demo/demo-request-form";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Request a Demo",
  description: "Tell us about your institution and we'll walk you through the toolkit and how licensing works for your cohort.",
  path: "/demo",
});

export default function DemoPage() {
  return (
    <SplitFormPage
      eyebrow="For Universities"
      title={
        <>
          Request a <GradientText>demo</GradientText>
        </>
      }
      description="Tell us about your institution and we'll walk you through the toolkit and how licensing works for your cohort."
      points={[
        { icon: PresentationIcon, title: "A walkthrough of the toolkit", description: "See the CV builder, ATS scanner, interview coach and sponsor data working together." },
        { icon: KeyRoundIcon, title: "How licensing works", description: "Seats, access codes and how students join, explained for your cohort size." },
        { icon: BarChart3Icon, title: "What careers teams see", description: "The institution dashboard and the aggregate usage reporting it gives your team." },
      ]}
      form={<DemoRequestForm />}
      formTitle="Tell us about your institution"
      formNote={
        <>
          Prefer email?{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="inline-flex items-center gap-1 text-foreground underline">
            <Mail className="size-3.5" />
            {siteConfig.supportEmail}
          </a>
        </>
      }
    />
  );
}
