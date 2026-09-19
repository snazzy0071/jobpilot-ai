import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { LayoutTemplateIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getCvEditorData, listCvVersions, getLatestAtsScan, listRecentJobOptions } from "@/lib/cvs/queries";
import { restoreVersion } from "@/lib/cvs/actions";
import { EditorHeader } from "@/components/cvs/editor/editor-header";
import { PersonalForm } from "@/components/cvs/editor/personal-form";
import { SummaryForm } from "@/components/cvs/editor/summary-form";
import { ExperienceSection } from "@/components/cvs/editor/experience-section";
import { EducationSection } from "@/components/cvs/editor/education-section";
import { SkillsSection } from "@/components/cvs/editor/skills-section";
import { ProjectsSection } from "@/components/cvs/editor/projects-section";
import { CertificationsSection } from "@/components/cvs/editor/certifications-section";
import { LanguagesSection } from "@/components/cvs/editor/languages-section";
import { CustomSectionsSection } from "@/components/cvs/editor/custom-sections-section";
import { CvPreviewProvider } from "@/components/cvs/editor/preview-context";
import { CvPreviewTabs } from "@/components/cvs/editor/cv-preview-tabs";
import { SectionOrderList } from "@/components/cvs/editor/section-order-list";
import { VersionHistoryDialog } from "@/components/cvs/editor/version-history-dialog";
import { MobilePreviewTrigger } from "@/components/cvs/editor/mobile-preview-trigger";
import { AtsPreflightPanel } from "@/components/cvs/editor/ats-preflight-panel";
import { BuildProgress } from "@/components/cvs/editor/build-progress";
import { SectionNav } from "@/components/cvs/editor/section-nav";
import { TemplatePickerDialog } from "@/components/cvs/templates/template-picker-dialog";
import { CurrentTemplateSummary } from "@/components/cvs/editor/current-template-summary";
import { sectionAnchorId } from "@/components/cvs/editor/jump-to-section";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import type { CvEditorData, SectionKey } from "@/lib/cvs/types";

export const dynamic = "force-dynamic";

/**
 * reference/auth/create-cv.png's "BUILD PROGRESS" percentage — a real
 * completeness signal from the 5 sections a CV always needs, not the
 * often-legitimately-empty extras (projects/certifications/languages/
 * custom sections), which would otherwise permanently cap a genuinely
 * complete CV below 100%.
 */
function computeBuildProgress(data: CvEditorData): number {
  const checks = [
    Boolean(data.personal?.fullName && data.personal?.email),
    Boolean(data.summary?.content?.trim()),
    data.experience.length > 0,
    data.education.length > 0,
    data.skills.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default async function CvEditorPage({ params }: { params: Promise<{ cvId: string }> }) {
  const { cvId } = await params;
  const user = await requireUser();
  const [data, versions] = await Promise.all([getCvEditorData(user.id, cvId), listCvVersions(user.id, cvId)]);
  if (!data) notFound();

  const [latestScan, recentJobOptions] = await Promise.all([
    getLatestAtsScan(user.id, data.versionId),
    listRecentJobOptions(user.id),
  ]);

  const accordionItems: Partial<Record<SectionKey, (index: number) => ReactNode>> = {
    personal: (index) => (
      <AccordionItem key="personal" value="personal" id={sectionAnchorId("personal")}>
        <AccordionTrigger className="font-heading text-lg font-semibold hover:no-underline">
          {index}. Personal details
        </AccordionTrigger>
        <AccordionContent>
          <PersonalForm versionId={data.versionId} initial={data.personal} />
        </AccordionContent>
      </AccordionItem>
    ),
    summary: (index) => (
      <AccordionItem key="summary" value="summary" id={sectionAnchorId("summary")}>
        <AccordionTrigger className="font-heading text-lg font-semibold hover:no-underline">
          {index}. Professional summary
        </AccordionTrigger>
        <AccordionContent>
          <SummaryForm versionId={data.versionId} initial={data.summary} />
        </AccordionContent>
      </AccordionItem>
    ),
    experience: (index) => (
      <AccordionItem key="experience" value="experience" id={sectionAnchorId("experience")}>
        <AccordionTrigger className="font-heading text-lg font-semibold hover:no-underline">
          {index}. Experience ({data.experience.length})
        </AccordionTrigger>
        <AccordionContent>
          <ExperienceSection versionId={data.versionId} items={data.experience} />
        </AccordionContent>
      </AccordionItem>
    ),
    education: (index) => (
      <AccordionItem key="education" value="education" id={sectionAnchorId("education")}>
        <AccordionTrigger className="font-heading text-lg font-semibold hover:no-underline">
          {index}. Education ({data.education.length})
        </AccordionTrigger>
        <AccordionContent>
          <EducationSection versionId={data.versionId} items={data.education} />
        </AccordionContent>
      </AccordionItem>
    ),
    skills: (index) => (
      <AccordionItem key="skills" value="skills" id={sectionAnchorId("skills")}>
        <AccordionTrigger className="font-heading text-lg font-semibold hover:no-underline">
          {index}. Skills ({data.skills.length})
        </AccordionTrigger>
        <AccordionContent>
          <SkillsSection versionId={data.versionId} items={data.skills} />
        </AccordionContent>
      </AccordionItem>
    ),
    projects: (index) => (
      <AccordionItem key="projects" value="projects" id={sectionAnchorId("projects")}>
        <AccordionTrigger className="font-heading text-lg font-semibold hover:no-underline">
          {index}. Projects ({data.projects.length})
        </AccordionTrigger>
        <AccordionContent>
          <ProjectsSection versionId={data.versionId} items={data.projects} />
        </AccordionContent>
      </AccordionItem>
    ),
    certifications: (index) => (
      <AccordionItem key="certifications" value="certifications" id={sectionAnchorId("certifications")}>
        <AccordionTrigger className="font-heading text-lg font-semibold hover:no-underline">
          {index}. Certifications ({data.certifications.length})
        </AccordionTrigger>
        <AccordionContent>
          <CertificationsSection versionId={data.versionId} items={data.certifications} />
        </AccordionContent>
      </AccordionItem>
    ),
    languages: (index) => (
      <AccordionItem key="languages" value="languages" id={sectionAnchorId("languages")}>
        <AccordionTrigger className="font-heading text-lg font-semibold hover:no-underline">
          {index}. Languages ({data.languages.length})
        </AccordionTrigger>
        <AccordionContent>
          <LanguagesSection versionId={data.versionId} items={data.languages} />
        </AccordionContent>
      </AccordionItem>
    ),
    customSections: (index) => (
      <AccordionItem key="customSections" value="customSections" id={sectionAnchorId("customSections")}>
        <AccordionTrigger className="font-heading text-lg font-semibold hover:no-underline">
          {index}. Custom sections ({data.customSections.length})
        </AccordionTrigger>
        <AccordionContent>
          <CustomSectionsSection versionId={data.versionId} items={data.customSections} />
        </AccordionContent>
      </AccordionItem>
    ),
  };

  const templateContent = {
    skills: data.skills,
    projects: data.projects,
    certifications: data.certifications,
    languages: data.languages,
    customSections: data.customSections,
    sectionOrder: data.sectionOrder,
  };

  return (
    <div className="flex flex-col gap-6">
      <CvPreviewProvider
        cvId={data.cvId}
        initial={{
          template: data.template,
          personal: data.personal,
          summary: data.summary,
          experience: data.experience,
          education: data.education,
        }}
      >
        {/* Real <h1> — this page previously had no heading of any
            level. EditorHeader's own title is an editable <Input>
            (rightly so — it's a live-editable field, not static text),
            so this is a separate, sr-only page title rather than
            changing that input's semantics. */}
        <h1 className="sr-only">{data.cvTitle}</h1>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <EditorHeader cvId={data.cvId} title={data.cvTitle} template={data.template} atsScore={data.atsScore} templateContent={templateContent} />
          <VersionHistoryDialog
            versions={versions}
            restore={restoreVersion}
            containerIdField="cvId"
            containerId={data.cvId}
          />
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <BuildProgress percent={computeBuildProgress(data)} />
            <SectionNav sections={data.sectionOrder} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LayoutTemplateIcon className="size-6" />
            </div>
            <CurrentTemplateSummary />
            <TemplatePickerDialog currentTemplate={data.template} content={templateContent} triggerLabel="Swap template" />
          </CardContent>
        </Card>

        <SectionOrderList versionId={data.versionId} order={data.sectionOrder} />

        <AtsPreflightPanel
          versionId={data.versionId}
          sectionOrder={data.sectionOrder}
          skills={data.skills}
          projects={data.projects}
          certifications={data.certifications}
          languages={data.languages}
          customSections={data.customSections}
          initialScan={latestScan}
          recentJobOptions={recentJobOptions}
        />

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
          {/* sr-only <h2> — bridges h1 above to each AccordionTrigger's
              own <h3> (Base UI's Accordion.Header default) so the
              sequence has no level skip. */}
          <h2 className="sr-only">CV sections</h2>
          <Accordion defaultValue={data.sectionOrder} multiple>
            {data.sectionOrder.map((key, index) => accordionItems[key]?.(index + 1))}
          </Accordion>

          {/* Desktop split-view — a permanently-visible sticky column. Hidden below lg: a second column doesn't fit at phone widths, and MobilePreviewTrigger below is the usable mobile equivalent, not this shrunk down. */}
          <div className="hidden lg:sticky lg:top-6 lg:block">
            <CvPreviewTabs
              cvId={data.cvId}
              sectionOrder={data.sectionOrder}
              skills={data.skills}
              projects={data.projects}
              certifications={data.certifications}
              languages={data.languages}
              customSections={data.customSections}
            />
          </div>
        </div>

        <div className="lg:hidden">
          <MobilePreviewTrigger
            cvId={data.cvId}
            sectionOrder={data.sectionOrder}
            skills={data.skills}
            projects={data.projects}
            certifications={data.certifications}
            languages={data.languages}
            customSections={data.customSections}
          />
        </div>
      </CvPreviewProvider>
    </div>
  );
}
