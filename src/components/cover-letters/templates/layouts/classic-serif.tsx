import { formatUkLetterDate } from "@/components/cover-letters/templates/format-date";
import type { CoverLetterTemplateContentData } from "@/components/cover-letters/templates/types";

/** Traditional UK business letter — serif throughout, sender block right-aligned at the top the way a typed formal letter has always been laid out, a single thin rule separating the letterhead from the body. */
export function ClassicSerifLayout({ data }: { data: CoverLetterTemplateContentData }) {
  const contactLine = [data.senderEmail, data.senderPhone, data.senderLocation].filter(Boolean).join("  ·  ");

  return (
    <div className="flex flex-col gap-6 p-12 font-serif text-[0.95rem] leading-relaxed text-neutral-900">
      <div className="text-right">
        <p className="text-lg font-semibold">{data.senderName ?? "Your Name"}</p>
        {contactLine && <p className="text-xs text-neutral-600">{contactLine}</p>}
        <p className="mt-3 text-xs text-neutral-600">{formatUkLetterDate()}</p>
      </div>

      <div className="border-t border-neutral-300 pt-6">
        <p className="font-medium">{data.companyName}</p>
        <p className="mt-4 text-xs font-semibold tracking-wide text-neutral-600 uppercase">Re: {data.jobTitle}</p>
      </div>

      <div className="flex flex-col gap-4">
        {data.paragraphs.length === 0 ? (
          <p className="text-neutral-400 italic">Your letter will appear here as you write it.</p>
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
