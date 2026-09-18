import { PersonalHeader, renderSectionBlock } from "@/components/cvs/templates/blocks";
import type { ThemeStyle } from "@/components/cvs/templates/theme-styles";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";

/** A bold colour band carries the name/headline; everything else is one linear column below it. */
export function HeaderBandLayout({ data, theme }: { data: CvTemplateContentData; theme: ThemeStyle }) {
  const bodyOrder = data.sectionOrder.filter((key) => key !== "personal");

  return (
    <div className="flex flex-col">
      <div className={`${theme.accentBg} p-10`}>
        <PersonalHeader data={data} theme={theme} variant="banner" />
      </div>
      <div className="flex flex-col gap-4 p-10">
        {bodyOrder.map((key) => (
          <div key={key}>{renderSectionBlock(key, data, theme)}</div>
        ))}
      </div>
    </div>
  );
}
