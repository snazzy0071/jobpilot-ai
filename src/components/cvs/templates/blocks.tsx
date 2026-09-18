import type { ReactNode } from "react";
import type { ThemeStyle } from "@/components/cvs/templates/theme-styles";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";
import type { SectionKey, LanguageProficiency } from "@/lib/cvs/types";
import { LANGUAGE_PROFICIENCY_LABELS } from "@/lib/cvs/types";

/** "compact" is what actually makes the compact-dense layout's 6 templates real, not just a relabelled single-column. */
export type Density = "regular" | "compact";

const SIZE: Record<Density, { heading: string; body: string; small: string; gap: string; blockGap: string }> = {
  regular: { heading: "text-[0.7rem]", body: "text-sm", small: "text-xs", gap: "gap-3", blockGap: "mt-1.5" },
  compact: { heading: "text-[0.62rem]", body: "text-xs", small: "text-[0.65rem]", gap: "gap-2", blockGap: "mt-1" },
};

function formatDateRange(start: string | null, end: string | null, isCurrent: boolean): string | null {
  if (!start && !end && !isCurrent) return null;
  const startLabel = start ?? "—";
  const endLabel = isCurrent ? "Present" : (end ?? "—");
  return `${startLabel} – ${endLabel}`;
}

/**
 * Every filtered/derived view a layout needs, computed once. Experience/
 * education require a real title before counting as "present" (an
 * in-progress "Add role" draft with nothing typed yet shouldn't render a
 * blank entry); the other five respect `isVisible`, same as the
 * non-templated preview did before this task.
 */
export function getVisibleContent(data: CvTemplateContentData) {
  return {
    experience: data.experience.filter((row) => row.jobTitle.trim() || row.employer.trim()),
    education: data.education.filter((row) => row.institution.trim() || row.qualification.trim()),
    skills: data.skills.filter((row) => row.isVisible),
    projects: data.projects.filter((row) => row.isVisible),
    certifications: data.certifications.filter((row) => row.isVisible),
    languages: data.languages.filter((row) => row.isVisible),
    customSections: data.customSections.filter((row) => row.isVisible),
  };
}

export function SectionHeading({
  children,
  theme,
  density = "regular",
  className = "",
}: {
  children: ReactNode;
  theme: ThemeStyle;
  density?: Density;
  className?: string;
}) {
  return (
    <h3
      className={`${SIZE[density].heading} break-after-avoid font-semibold tracking-widest uppercase ${theme.accentText} ${className}`}
    >
      {children}
    </h3>
  );
}

export function PersonalHeader({
  data,
  theme,
  variant,
}: {
  data: CvTemplateContentData;
  theme: ThemeStyle;
  variant: "stacked" | "banner";
}) {
  const { personal } = data;
  const contactLine = personal
    ? [personal.location, personal.email, personal.phone].filter(Boolean).join("  ·  ")
    : null;
  const linkLine = personal
    ? [personal.websiteUrl, personal.linkedinUrl, personal.portfolioUrl].filter(Boolean).join("  ·  ")
    : null;

  if (!personal?.fullName) {
    return <p className="text-sm text-muted-foreground italic">Add your personal details to see them here.</p>;
  }

  const nameClass = variant === "banner" ? "text-white" : theme.headingText;
  const subClass = variant === "banner" ? "text-white/80" : theme.accentText;

  return (
    <header className="break-after-avoid">
      <h2 className={`text-2xl font-bold tracking-tight ${theme.headingFont} ${nameClass}`}>{personal.fullName}</h2>
      {personal.headline && <p className={`mt-0.5 text-sm ${subClass}`}>{personal.headline}</p>}
      {contactLine && <p className={`mt-2 text-xs ${variant === "banner" ? "text-white/70" : "text-muted-foreground"}`}>{contactLine}</p>}
      {linkLine && <p className={`text-xs ${variant === "banner" ? "text-white/70" : "text-muted-foreground"}`}>{linkLine}</p>}
    </header>
  );
}

type BlockProps = { data: CvTemplateContentData; theme: ThemeStyle; density?: Density };

export function SummaryBlock({ data, theme, density = "regular" }: BlockProps) {
  if (!data.summary?.content) return null;
  const s = SIZE[density];
  return (
    <section className="break-inside-avoid">
      <SectionHeading theme={theme} density={density}>
        Summary
      </SectionHeading>
      <p className={`${s.blockGap} ${s.body} whitespace-pre-wrap ${theme.bodyText}`}>{data.summary.content}</p>
    </section>
  );
}

export function ExperienceBlock({ data, theme, density = "regular" }: BlockProps) {
  const items = getVisibleContent(data).experience;
  if (items.length === 0) return null;
  const s = SIZE[density];
  return (
    <section>
      <SectionHeading theme={theme} density={density}>
        Experience
      </SectionHeading>
      <div className={`${s.blockGap} flex flex-col ${s.gap}`}>
        {items.map((row) => {
          const dateRange = formatDateRange(row.startDate || null, row.endDate, row.isCurrent);
          return (
            <div key={row.id} className="break-inside-avoid">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`${s.body} font-semibold ${theme.headingText}`}>{row.jobTitle || "Untitled role"}</p>
                {dateRange && <p className={`${s.small} whitespace-nowrap text-muted-foreground`}>{dateRange}</p>}
              </div>
              <p className={`${s.body} ${theme.accentText}`}>
                {row.employer}
                {row.location ? `  ·  ${row.location}` : ""}
              </p>
              {row.description && <p className={`mt-1 ${s.body} whitespace-pre-wrap ${theme.bodyText}`}>{row.description}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function EducationBlock({ data, theme, density = "regular" }: BlockProps) {
  const items = getVisibleContent(data).education;
  if (items.length === 0) return null;
  const s = SIZE[density];
  return (
    <section>
      <SectionHeading theme={theme} density={density}>
        Education
      </SectionHeading>
      <div className={`${s.blockGap} flex flex-col ${s.gap}`}>
        {items.map((row) => {
          const dateRange = formatDateRange(row.startDate, row.endDate, row.isCurrent);
          return (
            <div key={row.id} className="break-inside-avoid">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`${s.body} font-semibold ${theme.headingText}`}>{row.qualification || "Untitled qualification"}</p>
                {dateRange && <p className={`${s.small} whitespace-nowrap text-muted-foreground`}>{dateRange}</p>}
              </div>
              <p className={`${s.body} ${theme.accentText}`}>
                {row.institution}
                {row.fieldOfStudy ? `  ·  ${row.fieldOfStudy}` : ""}
              </p>
              {row.grade && <p className={`${s.small} text-muted-foreground`}>{row.grade}</p>}
              {row.description && <p className={`mt-1 ${s.body} whitespace-pre-wrap ${theme.bodyText}`}>{row.description}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function SkillsBlock({ data, theme, density = "regular" }: BlockProps) {
  const items = getVisibleContent(data).skills;
  if (items.length === 0) return null;
  const s = SIZE[density];
  return (
    <section>
      <SectionHeading theme={theme} density={density}>
        Skills
      </SectionHeading>
      <p className={`${s.blockGap} ${s.body} ${theme.bodyText}`}>{items.map((row) => row.name).join("  ·  ")}</p>
    </section>
  );
}

export function ProjectsBlock({ data, theme, density = "regular" }: BlockProps) {
  const items = getVisibleContent(data).projects;
  if (items.length === 0) return null;
  const s = SIZE[density];
  return (
    <section>
      <SectionHeading theme={theme} density={density}>
        Projects
      </SectionHeading>
      <div className={`${s.blockGap} flex flex-col gap-2.5`}>
        {items.map((row) => (
          <div key={row.id} className="break-inside-avoid">
            <p className={`${s.body} font-semibold ${theme.headingText}`}>{row.name}</p>
            {row.technologies.length > 0 && <p className={`${s.small} text-muted-foreground`}>{row.technologies.join("  ·  ")}</p>}
            {row.description && <p className={`mt-0.5 ${s.body} whitespace-pre-wrap ${theme.bodyText}`}>{row.description}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function CertificationsBlock({ data, theme, density = "regular" }: BlockProps) {
  const items = getVisibleContent(data).certifications;
  if (items.length === 0) return null;
  const s = SIZE[density];
  return (
    <section>
      <SectionHeading theme={theme} density={density}>
        Certifications
      </SectionHeading>
      <div className={`${s.blockGap} flex flex-col gap-1.5`}>
        {items.map((row) => (
          <div key={row.id} className="break-inside-avoid">
            <p className={`${s.body} font-semibold ${theme.headingText}`}>{row.name}</p>
            <p className={`${s.small} ${theme.accentText}`}>{row.issuingOrganization}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LanguagesBlock({ data, theme, density = "regular" }: BlockProps) {
  const items = getVisibleContent(data).languages;
  if (items.length === 0) return null;
  const s = SIZE[density];
  return (
    <section>
      <SectionHeading theme={theme} density={density}>
        Languages
      </SectionHeading>
      <p className={`${s.blockGap} ${s.body} ${theme.bodyText}`}>
        {items.map((row) => `${row.name} (${LANGUAGE_PROFICIENCY_LABELS[row.proficiency as LanguageProficiency]})`).join("  ·  ")}
      </p>
    </section>
  );
}

export function CustomSectionsBlock({ data, theme, density = "regular" }: BlockProps) {
  const items = getVisibleContent(data).customSections;
  if (items.length === 0) return null;
  const s = SIZE[density];
  return (
    <>
      {items.map((row) => (
        <section key={row.id} className="break-inside-avoid">
          <SectionHeading theme={theme} density={density}>
            {row.title}
          </SectionHeading>
          {row.content && <p className={`${s.blockGap} ${s.body} whitespace-pre-wrap ${theme.bodyText}`}>{row.content}</p>}
        </section>
      ))}
    </>
  );
}

/**
 * One place mapping a section key to its block — every layout iterates
 * `sectionOrder` through this instead of separately hand-wiring the same
 * 8 conditionals 4 times. "personal" renders `null` here deliberately —
 * every layout renders the header itself (its position/style varies too
 * much per layout — banner vs stacked vs sidebar-top — to share), always
 * at the top regardless of where "personal" falls in `sectionOrder`: a
 * name/contact header floating into the middle of a real template would
 * just look broken, unlike the free-form editor preview this engine is
 * independent from.
 */
export function renderSectionBlock(key: SectionKey, data: CvTemplateContentData, theme: ThemeStyle, density: Density = "regular"): ReactNode {
  switch (key) {
    case "personal":
      return null;
    case "summary":
      return <SummaryBlock data={data} theme={theme} density={density} />;
    case "experience":
      return <ExperienceBlock data={data} theme={theme} density={density} />;
    case "education":
      return <EducationBlock data={data} theme={theme} density={density} />;
    case "skills":
      return <SkillsBlock data={data} theme={theme} density={density} />;
    case "projects":
      return <ProjectsBlock data={data} theme={theme} density={density} />;
    case "certifications":
      return <CertificationsBlock data={data} theme={theme} density={density} />;
    case "languages":
      return <LanguagesBlock data={data} theme={theme} density={density} />;
    case "customSections":
      return <CustomSectionsBlock data={data} theme={theme} density={density} />;
    default:
      return null;
  }
}
