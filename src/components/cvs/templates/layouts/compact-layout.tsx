import { PersonalHeader, renderSectionBlock } from "@/components/cvs/templates/blocks";
import type { ThemeStyle } from "@/components/cvs/templates/theme-styles";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";

/** Tighter type and spacing throughout (`density="compact"`, threaded into every block) — for a long career history that needs to fit within 2 pages. */
export function CompactLayout({ data, theme }: { data: CvTemplateContentData; theme: ThemeStyle }) {
  const bodyOrder = data.sectionOrder.filter((key) => key !== "personal");

  return (
    <div className="flex flex-col gap-2.5 p-8">
      <div className={`border-b pb-2.5 ${theme.ruleColor}`}>
        <PersonalHeader data={data} theme={theme} variant="stacked" />
      </div>
      {bodyOrder.map((key) => (
        <div key={key}>{renderSectionBlock(key, data, theme, "compact")}</div>
      ))}
    </div>
  );
}
