import { PersonalHeader, renderSectionBlock } from "@/components/cvs/templates/blocks";
import type { ThemeStyle } from "@/components/cvs/templates/theme-styles";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";

/** The traditional, safest-of-all layout: everything in one linear column, top to bottom. */
export function SingleColumnLayout({ data, theme }: { data: CvTemplateContentData; theme: ThemeStyle }) {
  const bodyOrder = data.sectionOrder.filter((key) => key !== "personal");

  return (
    <div className="flex flex-col gap-4 p-10">
      <div className={`border-b pb-4 ${theme.ruleColor}`}>
        <PersonalHeader data={data} theme={theme} variant="stacked" />
      </div>
      {bodyOrder.map((key) => (
        <div key={key}>{renderSectionBlock(key, data, theme)}</div>
      ))}
    </div>
  );
}
