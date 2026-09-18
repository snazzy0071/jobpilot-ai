import { formatUkLetterDate } from "@/components/cover-letters/templates/format-date";
import type { CoverLetterTemplateContentData } from "@/components/cover-letters/templates/types";

/** Clean sans-serif letterhead, left-aligned — a bold name, a muted contact row, and one accent-coloured rule doing all the visual separating work instead of borders or boxes. */
export function ModernBlockLayout({ data }: { data: CoverLetterTemplateContentData }) {
  const contactLine = [data.senderEmail, data.senderPhone, data.senderLocation].filter(Boolean).join("   ");

  return (
    <div className="flex flex-col gap-6 p-12 font-sans text-[0.95rem] leading-relaxed text-neutral-900">
      <div>
        <p className="text-2xl font-bold tracking-tight">{data.senderName ?? "Your Name"}</p>
        {contactLine && <p className="mt-1 text-xs text-neutral-500">{contactLine}</p>}
      </div>

      <div className="h-1 w-16 rounded-full bg-indigo-600" />

      <div className="flex items-baseline justify-between text-xs text-neutral-600">
        <p>{formatUkLetterDate()}</p>
        <p className="font-semibold text-neutral-900">{data.companyName}</p>
      </div>

      <p className="text-xs font-semibold tracking-wide text-indigo-600 uppercase">Application: {data.jobTitle}</p>

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
