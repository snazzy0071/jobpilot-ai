import { PersonalHeader, renderSectionBlock } from "@/components/cvs/templates/blocks";
import type { ThemeStyle } from "@/components/cvs/templates/theme-styles";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";
import type { SectionKey } from "@/lib/cvs/types";

const SIDEBAR_KEYS: SectionKey[] = ["skills", "languages"];

/**
 * A narrow contact/skills column beside the main content. ATS-safe by
 * construction: the DOM order is header, then *main* content, then
 * *sidebar* content — a sensible linear reading order for any parser
 * that extracts text by DOM position — while CSS Grid's explicit
 * `col-start`/`row-start` placement (not `order`, and not relying on
 * grid auto-placement, which would follow DOM order and put the wrong
 * content on the wrong side) puts the sidebar visually on the left
 * regardless of that DOM order.
 */
export function SidebarLayout({ data, theme }: { data: CvTemplateContentData; theme: ThemeStyle }) {
  const bodyOrder = data.sectionOrder.filter((key) => key !== "personal");
  const sidebarOrder = bodyOrder.filter((key) => SIDEBAR_KEYS.includes(key));
  const mainOrder = bodyOrder.filter((key) => !SIDEBAR_KEYS.includes(key));

  return (
    <div className="flex flex-col">
      <div className={`p-8 pb-6 ${theme.accentBgSoft}`}>
        <PersonalHeader data={data} theme={theme} variant="stacked" />
      </div>
      <div className="grid grid-cols-[190px_1fr] gap-8 p-8 pt-6">
        <div className="col-start-2 row-start-1 flex flex-col gap-4">
          {mainOrder.map((key) => (
            <div key={key}>{renderSectionBlock(key, data, theme)}</div>
          ))}
        </div>
        <div className="col-start-1 row-start-1 flex flex-col gap-4">
          {sidebarOrder.map((key) => (
            <div key={key}>{renderSectionBlock(key, data, theme)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
