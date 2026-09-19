import type { CSSProperties, ReactNode } from "react";
import { LANGUAGE_PROFICIENCY_LABELS, type CvSkill, type LanguageProficiency, type SectionKey } from "@/lib/cvs/types";
import { formatDateRange, formatMonth, getVisibleContent } from "@/components/cvs/templates/content";
import {
  ATOM,
  ATOM_STYLE,
  Description,
  Entry,
  SectionHeading,
  colorOf,
  fontOf,
  type Ctx,
} from "@/components/cvs/templates/primitives";
import type { SkillsStyle } from "@/components/cvs/templates/design";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";

const DEFAULT_LABELS = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  languages: "Languages",
} as const;

type LabelKey = keyof typeof DEFAULT_LABELS;

export type SectionPlacement = "stack" | "gutter";
export type RenderOptions = { first: boolean; placement: SectionPlacement };

function label(ctx: Ctx, key: LabelKey): string {
  return ctx.design.labels[key] ?? DEFAULT_LABELS[key];
}

function SectionBlock({
  ctx,
  title,
  children,
  options,
}: {
  ctx: Ctx;
  title: string;
  children: ReactNode;
  options: RenderOptions;
}) {
  const { design } = ctx;
  const marginTop = options.first ? 0 : design.spacing.section;

  if (options.placement === "gutter" && design.gutter) {
    const g = design.gutter;
    return (
      <section style={{ display: "grid", gridTemplateColumns: `${g.width}px minmax(0, 1fr)`, columnGap: g.gap, marginTop, alignItems: "start" }}>
        <div style={{ paddingTop: 2 }}>
          <SectionHeading ctx={ctx} align={g.align}>
            {title}
          </SectionHeading>
        </div>
        <div>{children}</div>
      </section>
    );
  }

  return (
    <section style={{ marginTop }}>
      <SectionHeading ctx={ctx}>{title}</SectionHeading>
      <div style={{ marginTop: design.spacing.heading }}>{children}</div>
    </section>
  );
}

// ---- skills ----------------------------------------------------------------

function groupSkills(skills: CvSkill[]): { label: string | null; names: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const skill of skills) {
    const key = skill.category?.trim() || "";
    const list = groups.get(key) ?? [];
    list.push(skill.name);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([category, names]) => ({ label: category || (groups.size > 1 ? "Other" : null), names }));
}

function SkillsBody({ ctx, skills }: { ctx: Ctx; skills: CvSkill[] }) {
  const { design, tone } = ctx;
  const small = design.type.small;
  const names = skills.map((skill) => skill.name);
  const hasCategories = skills.some((skill) => skill.category?.trim());

  let style: SkillsStyle = tone.skills;
  if (!hasCategories) {
    if (style === "grouped") style = "inline";
    if (style === "grouped-stacked") style = "list";
  }

  const chipBase: CSSProperties = { fontSize: small + 0.5, padding: "2px 9px", lineHeight: 1.35, color: tone.ink };

  switch (style) {
    case "comma":
      return (
        <p {...ATOM} style={{ ...ATOM_STYLE, margin: 0, color: tone.ink }}>
          {names.join(", ")}
        </p>
      );

    case "chips":
    case "chips-fill":
      return (
        <ul {...ATOM} style={{ ...ATOM_STYLE, display: "flex", flexWrap: "wrap", gap: "5px 6px", margin: 0, padding: 0, listStyle: "none" }}>
          {names.map((name, index) => (
            <li
              key={index}
              style={
                style === "chips"
                  ? { ...chipBase, border: `1px solid color-mix(in srgb, ${tone.muted} 55%, transparent)`, borderRadius: 4 }
                  : { ...chipBase, background: tone.accentSoft, borderRadius: 3 }
              }
            >
              {name}
            </li>
          ))}
        </ul>
      );

    case "columns":
      return (
        <ul
          {...ATOM}
          style={{ ...ATOM_STYLE, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "3px 18px", margin: 0, padding: 0, listStyle: "none" }}
        >
          {names.map((name, index) => (
            <li key={index} style={{ position: "relative", paddingLeft: 11, color: tone.ink }}>
              <span aria-hidden style={{ position: "absolute", left: 0, top: "0.72em", width: 5, height: 1.5, background: tone.accent }} />
              {name}
            </li>
          ))}
        </ul>
      );

    case "list":
      return (
        <div {...ATOM} style={{ ...ATOM_STYLE, color: tone.ink }}>
          {names.map((name, index) => (
            <div key={index} style={{ marginTop: index === 0 ? 0 : 3 }}>
              {name}
            </div>
          ))}
        </div>
      );

    case "grouped":
    case "grouped-stacked": {
      const stacked = style === "grouped-stacked";
      return (
        <div>
          {groupSkills(skills).map((group, index) => (
            <div
              key={group.label ?? "all"}
              {...ATOM}
              style={
                stacked
                  ? { ...ATOM_STYLE, marginTop: index === 0 ? 0 : 8 }
                  : { ...ATOM_STYLE, display: "grid", gridTemplateColumns: "118px minmax(0, 1fr)", columnGap: 12, marginTop: index === 0 ? 0 : 4 }
              }
            >
              {group.label && (
                <div
                  style={{
                    fontFamily: fontOf(design, design.heading.font),
                    fontWeight: 600,
                    fontSize: stacked ? small : small + 0.5,
                    color: stacked ? tone.muted : colorOf(tone, "ink"),
                    textTransform: stacked ? "uppercase" : "none",
                    letterSpacing: stacked ? "0.06em" : undefined,
                  }}
                >
                  {group.label}
                </div>
              )}
              <div style={{ color: tone.ink, marginTop: stacked && group.label ? 1 : 0 }}>{group.names.join(", ")}</div>
            </div>
          ))}
        </div>
      );
    }

    default:
      return (
        <p {...ATOM} style={{ ...ATOM_STYLE, margin: 0, color: tone.ink }}>
          {names.join("  ·  ")}
        </p>
      );
  }
}

// ---- individual sections ---------------------------------------------------

function SummarySection({ data, ctx, options }: { data: CvTemplateContentData; ctx: Ctx; options: RenderOptions }) {
  const content = data.summary?.content?.trim();
  if (!content) return null;
  const { design, tone } = ctx;

  const base: CSSProperties = { ...ATOM_STYLE, margin: 0, whiteSpace: "pre-wrap", color: tone.ink };
  let style: CSSProperties = base;
  switch (design.summary) {
    case "panel":
      style = { ...base, background: tone.accentSoft, padding: "11px 14px", borderRadius: 2 };
      break;
    case "lead":
      style = { ...base, fontSize: design.type.base + 2, lineHeight: 1.5, fontFamily: fontOf(design, "heading") };
      break;
    case "bar":
      style = { ...base, borderLeft: `3px solid ${tone.accent}`, paddingLeft: 12 };
      break;
  }
  return (
    <SectionBlock ctx={ctx} title={label(ctx, "summary")} options={options}>
      <p {...ATOM} style={style}>
        {content}
      </p>
    </SectionBlock>
  );
}

function ExperienceSection({ data, ctx, options }: { data: CvTemplateContentData; ctx: Ctx; options: RenderOptions }) {
  const rows = getVisibleContent(data).experience;
  if (rows.length === 0) return null;
  return (
    <SectionBlock ctx={ctx} title={label(ctx, "experience")} options={options}>
      {rows.map((row, index) => (
        <Entry
          key={row.id}
          ctx={ctx}
          index={index}
          title={row.jobTitle || "Untitled role"}
          subtitle={[row.employer, row.location].filter(Boolean).join("  ·  ") || undefined}
          dates={formatDateRange(row.startDate || null, row.endDate, row.isCurrent)}
          description={row.description}
          swappable={Boolean(row.employer)}
        />
      ))}
    </SectionBlock>
  );
}

function EducationSection({ data, ctx, options }: { data: CvTemplateContentData; ctx: Ctx; options: RenderOptions }) {
  const rows = getVisibleContent(data).education;
  if (rows.length === 0) return null;
  return (
    <SectionBlock ctx={ctx} title={label(ctx, "education")} options={options}>
      {rows.map((row, index) => {
        const field = row.fieldOfStudy && !row.qualification.toLowerCase().includes(row.fieldOfStudy.toLowerCase()) ? row.fieldOfStudy : null;
        return (
          <Entry
            key={row.id}
            ctx={ctx}
            index={index}
            title={row.qualification || "Untitled qualification"}
            subtitle={[row.institution, field, row.location].filter(Boolean).join("  ·  ") || undefined}
            dates={formatDateRange(row.startDate, row.endDate, row.isCurrent)}
            extra={row.grade || undefined}
            description={row.description}
            swappable={Boolean(row.institution)}
          />
        );
      })}
    </SectionBlock>
  );
}

function SkillsSection({ data, ctx, options }: { data: CvTemplateContentData; ctx: Ctx; options: RenderOptions }) {
  const rows = getVisibleContent(data).skills;
  if (rows.length === 0) return null;
  return (
    <SectionBlock ctx={ctx} title={label(ctx, "skills")} options={options}>
      <SkillsBody ctx={ctx} skills={rows} />
    </SectionBlock>
  );
}

function ProjectsSection({ data, ctx, options }: { data: CvTemplateContentData; ctx: Ctx; options: RenderOptions }) {
  const rows = getVisibleContent(data).projects;
  if (rows.length === 0) return null;
  return (
    <SectionBlock ctx={ctx} title={label(ctx, "projects")} options={options}>
      {rows.map((row, index) => (
        <Entry
          key={row.id}
          ctx={ctx}
          index={index}
          title={row.name}
          subtitle={row.technologies.length > 0 ? row.technologies.join("  ·  ") : undefined}
          dates={formatDateRange(row.startDate, row.endDate, row.isOngoing)}
          extra={row.url || undefined}
          description={row.description}
        />
      ))}
    </SectionBlock>
  );
}

function CertificationsSection({ data, ctx, options }: { data: CvTemplateContentData; ctx: Ctx; options: RenderOptions }) {
  const rows = getVisibleContent(data).certifications;
  if (rows.length === 0) return null;
  return (
    <SectionBlock ctx={ctx} title={label(ctx, "certifications")} options={options}>
      {rows.map((row, index) => (
        <Entry
          key={row.id}
          ctx={ctx}
          index={index}
          title={row.name}
          subtitle={row.issuingOrganization || undefined}
          dates={formatMonth(row.issueDate)}
        />
      ))}
    </SectionBlock>
  );
}

function LanguagesSection({ data, ctx, options }: { data: CvTemplateContentData; ctx: Ctx; options: RenderOptions }) {
  const rows = getVisibleContent(data).languages;
  if (rows.length === 0) return null;
  const { tone } = ctx;
  const proficiency = (value: string) => LANGUAGE_PROFICIENCY_LABELS[value as LanguageProficiency];

  return (
    <SectionBlock ctx={ctx} title={label(ctx, "languages")} options={options}>
      {tone.isSidebar || tone.skills === "list" ? (
        <div {...ATOM} style={{ ...ATOM_STYLE, color: tone.ink }}>
          {rows.map((row, index) => (
            <div key={row.id} style={{ marginTop: index === 0 ? 0 : 3 }}>
              {row.name} <span style={{ color: tone.muted, fontSize: ctx.design.type.small }}>{proficiency(row.proficiency)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p {...ATOM} style={{ ...ATOM_STYLE, margin: 0, color: tone.ink }}>
          {rows.map((row) => `${row.name} (${proficiency(row.proficiency)})`).join("  ·  ")}
        </p>
      )}
    </SectionBlock>
  );
}

function CustomSections({ data, ctx, options }: { data: CvTemplateContentData; ctx: Ctx; options: RenderOptions }) {
  const rows = getVisibleContent(data).customSections;
  if (rows.length === 0) return null;
  return (
    <>
      {rows.map((row, index) => (
        <SectionBlock key={row.id} ctx={ctx} title={row.title} options={{ ...options, first: options.first && index === 0 }}>
          <Description text={row.content} ctx={ctx} marginTop={0} />
        </SectionBlock>
      ))}
    </>
  );
}

/**
 * The one place mapping a section key to its renderer — every frame
 * iterates `sectionOrder` through this, so the same data renders in every
 * template. "personal" renders nothing here on purpose: each template
 * draws the header itself, always at the top, wherever "personal" falls
 * in the order.
 */
export function renderSection(key: SectionKey, data: CvTemplateContentData, ctx: Ctx, options: RenderOptions): ReactNode {
  switch (key) {
    case "summary":
      return <SummarySection data={data} ctx={ctx} options={options} />;
    case "experience":
      return <ExperienceSection data={data} ctx={ctx} options={options} />;
    case "education":
      return <EducationSection data={data} ctx={ctx} options={options} />;
    case "skills":
      return <SkillsSection data={data} ctx={ctx} options={options} />;
    case "projects":
      return <ProjectsSection data={data} ctx={ctx} options={options} />;
    case "certifications":
      return <CertificationsSection data={data} ctx={ctx} options={options} />;
    case "languages":
      return <LanguagesSection data={data} ctx={ctx} options={options} />;
    case "customSections":
      return <CustomSections data={data} ctx={ctx} options={options} />;
    default:
      return null;
  }
}
