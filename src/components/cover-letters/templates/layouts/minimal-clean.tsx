import { formatUkLetterDate } from "@/components/cover-letters/templates/format-date";
import type { CoverLetterTemplateContentData } from "@/components/cover-letters/templates/types";

/** Understated on purpose — no rules, no boxes, no colour. Wide letter-spacing on the name and generous whitespace do the work a border would do elsewhere. */
export function MinimalCleanLayout({ data }: { data: CoverLetterTemplateContentData }) {
  const contactLine = [data.senderEmail, data.senderPhone, data.senderLocation].filter(Boolean).join("   ");

  return (
    <div className="flex flex-col gap-8 p-14 font-sans text-[0.95rem] leading-loose text-neutral-800">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium tracking-[0.2em] text-neutral-900 uppercase">
          {data.senderName ?? "Your Name"}
        </p>
        {contactLine && <p className="text-xs text-neutral-400">{contactLine}</p>}
      </div>

      <div className="flex flex-col gap-0.5 text-xs text-neutral-400">
        <p>{formatUkLetterDate()}</p>
        <p>
          {data.companyName} — {data.jobTitle}
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {data.paragraphs.length === 0 ? (
          <p className="text-neutral-300 italic">Your letter will appear here as you write it.</p>
        ) : (
          data.paragraphs.map((paragraph) => (
            <p key={paragraph.id} className="whitespace-pre-wrap">
              {paragraph.content}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
