import { formatUkLetterDate } from "@/components/cover-letters/templates/format-date";
import type { CoverLetterTemplateContentData } from "@/components/cover-letters/templates/types";

/** A solid colour band carries the name and contact details — the one templates here that leads with colour rather than typography, echoing the confidence of a CV "header band" layout but built fresh for a letter's simpler structure. */
export function BoldHeaderLayout({ data }: { data: CoverLetterTemplateContentData }) {
  const contactLine = [data.senderEmail, data.senderPhone, data.senderLocation].filter(Boolean).join("  ·  ");

  return (
    <div className="flex flex-col font-sans text-[0.95rem] leading-relaxed text-neutral-900">
      <div className="bg-slate-900 px-12 py-8 text-white">
        <p className="text-2xl font-bold">{data.senderName ?? "Your Name"}</p>
        {contactLine && <p className="mt-1 text-xs text-slate-300">{contactLine}</p>}
      </div>

      <div className="flex flex-col gap-6 p-12">
        <div className="flex items-baseline justify-between text-xs text-neutral-600">
          <p>{formatUkLetterDate()}</p>
          <p className="font-semibold text-neutral-900">{data.companyName}</p>
        </div>

        <p className="-mt-3 text-xs font-semibold tracking-wide text-slate-700 uppercase">Re: {data.jobTitle}</p>

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
    </div>
  );
}
