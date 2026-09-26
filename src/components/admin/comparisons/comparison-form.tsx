"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createComparison, updateComparison } from "@/lib/comparisons/actions";
import { JOBPILOT_LEVELS, SUPPORT_LABELS, SUPPORT_LEVELS, type ComparisonDifference, type ComparisonFaq, type ComparisonFeature, type ComparisonPage, type ComparisonPricing } from "@/lib/comparisons/types";
import { todayInUk } from "@/lib/graduate-schemes/status";

const SELECT_CLASS = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const emptyFeature = (): ComparisonFeature => ({ label: "", competitor: "unknown", competitorNote: null, jobpilot: "yes", jobpilotNote: null, sourceUrl: null, sourceDate: null });
const emptyPricing = (): ComparisonPricing => ({ plan: "", price: "", notes: null, sourceUrl: "", sourceDate: todayInUk() });
const emptyDifference = (): ComparisonDifference => ({ title: "", competitor: "", jobpilot: "", sourceUrl: "", sourceDate: todayInUk() });
const emptyFaq = (): ComparisonFaq => ({ question: "", answer: "", sourceUrl: null, sourceDate: null });

/** A repeatable group: rows with their own remove button and an "Add" button; the parent serialises the array into a hidden field. */
function Rows<T>({ title, hint, items, onChange, make, addLabel, itemName, render }: { title: string; hint: string; items: T[]; onChange: (items: T[]) => void; make: () => T; addLabel: string; itemName: string; render: (item: T, update: (patch: Partial<T>) => void, index: number) => React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-base font-semibold">{title}</legend>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {items.map((item, index) => (
        <Card key={index} className="gap-3 p-4" data-testid={`${itemName}-row`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              {itemName} {index + 1}
            </span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${itemName} ${index + 1}`} onClick={() => onChange(items.filter((_, i) => i !== index))}>
              <Trash2Icon className="size-4" />
            </Button>
          </div>
          {render(item, (patch) => onChange(items.map((current, i) => (i === index ? { ...current, ...patch } : current))), index)}
        </Card>
      ))}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange([...items, make()])}>
        <PlusIcon className="size-4" /> {addLabel}
      </Button>
    </fieldset>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function Evidence({ prefix, index, sourceUrl, sourceDate, onChange, required }: { prefix: string; index: number; sourceUrl: string | null; sourceDate: string | null; onChange: (patch: { sourceUrl: string; sourceDate: string }) => void; required: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="sm:col-span-2">
        <Field id={`${prefix}-${index}-url`} label={`Source link ${required ? "" : "(optional)"}`.trim()}>
          <Input id={`${prefix}-${index}-url`} type="url" value={sourceUrl ?? ""} onChange={(e) => onChange({ sourceUrl: e.target.value, sourceDate: sourceDate ?? "" })} placeholder="https://… (the competitor's own public page)" />
        </Field>
      </div>
      <Field id={`${prefix}-${index}-date`} label="Date checked">
        <Input id={`${prefix}-${index}-date`} type="date" max={todayInUk()} value={sourceDate ?? ""} onChange={(e) => onChange({ sourceUrl: sourceUrl ?? "", sourceDate: e.target.value })} />
      </Field>
    </div>
  );
}

export function ComparisonForm({ page }: { page?: ComparisonPage }) {
  const router = useRouter();
  const isEditing = !!page;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [features, setFeatures] = useState<ComparisonFeature[]>(page?.features ?? []);
  const [pricing, setPricing] = useState<ComparisonPricing[]>(page?.pricing ?? []);
  const [differences, setDifferences] = useState<ComparisonDifference[]>(page?.differences ?? []);
  const [faqs, setFaqs] = useState<ComparisonFaq[]>(page?.faqs ?? []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const response = isEditing ? await updateComparison(undefined, formData) : await createComparison(formData);
    if ("error" in response) {
      setLoading(false);
      setError(response.error);
      return;
    }
    router.push("/admin/compare");
    router.refresh();
  }

  return (
    <Card className="p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {isEditing && <input type="hidden" name="id" value={page.id} />}
        <input type="hidden" name="features" value={JSON.stringify(features)} />
        <input type="hidden" name="pricing" value={JSON.stringify(pricing)} />
        <input type="hidden" name="differences" value={JSON.stringify(differences)} />
        <input type="hidden" name="faqs" value={JSON.stringify(faqs)} />

        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          Only enter what the competitor itself has published, and only after you have looked at that page today. Every claim needs its source link and the date you checked it; if you can&apos;t confirm something, mark it &ldquo;Not confirmed&rdquo; rather than guessing. Don&apos;t state opinions as facts.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="c-name" label="Competitor name">
            <Input id="c-name" name="competitorName" defaultValue={page?.competitorName} maxLength={100} required />
          </Field>
          <Field id="c-slug" label="URL slug">
            <Input id="c-slug" name="slug" defaultValue={page?.slug} maxLength={100} placeholder="e.g. jobscan" required />
          </Field>
          <Field id="c-website" label="Competitor website (optional)">
            <Input id="c-website" name="competitorWebsite" type="url" defaultValue={page?.competitorWebsite ?? ""} placeholder="https://…" />
          </Field>
          <Field id="c-updated" label="Information checked on">
            <Input id="c-updated" name="updatedOn" type="date" max={todayInUk()} defaultValue={page?.updatedOn ?? todayInUk()} required />
          </Field>
        </div>

        <Field id="c-intro" label="Introduction (optional)">
          <Textarea id="c-intro" name="intro" rows={3} maxLength={1500} defaultValue={page?.intro ?? ""} placeholder="A neutral line or two, in your own words, on what the competitor is and what this comparison covers." />
        </Field>

        <Rows
          title="Features"
          hint="What each product offers. For the competitor, choose Yes/Partly/No only where its own page says so — with the source; otherwise leave Not confirmed."
          items={features}
          onChange={setFeatures}
          make={emptyFeature}
          addLabel="Add feature"
          itemName="feature"
          render={(item, update, index) => (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <Field id={`f-${index}-label`} label="Feature">
                    <Input id={`f-${index}-label`} value={item.label} onChange={(e) => update({ label: e.target.value })} maxLength={120} />
                  </Field>
                </div>
                <Field id={`f-${index}-comp`} label="Competitor">
                  <select id={`f-${index}-comp`} className={SELECT_CLASS} value={item.competitor} onChange={(e) => update({ competitor: e.target.value as ComparisonFeature["competitor"], ...(e.target.value === "unknown" ? { sourceUrl: null, sourceDate: null } : {}) })}>
                    {SUPPORT_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {SUPPORT_LABELS[level]}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field id={`f-${index}-compnote`} label="Competitor note (optional)">
                    <Input id={`f-${index}-compnote`} value={item.competitorNote ?? ""} onChange={(e) => update({ competitorNote: e.target.value })} maxLength={300} />
                  </Field>
                </div>
                <Field id={`f-${index}-jp`} label="JobPilot AI">
                  <select id={`f-${index}-jp`} className={SELECT_CLASS} value={item.jobpilot} onChange={(e) => update({ jobpilot: e.target.value as ComparisonFeature["jobpilot"] })}>
                    {JOBPILOT_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {SUPPORT_LABELS[level]}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field id={`f-${index}-jpnote`} label="JobPilot AI note (optional)">
                    <Input id={`f-${index}-jpnote`} value={item.jobpilotNote ?? ""} onChange={(e) => update({ jobpilotNote: e.target.value })} maxLength={300} />
                  </Field>
                </div>
              </div>
              {item.competitor !== "unknown" ? (
                <Evidence prefix="f" index={index} sourceUrl={item.sourceUrl} sourceDate={item.sourceDate} onChange={update} required />
              ) : (
                <p className="text-xs text-muted-foreground">Not confirmed — no source needed, and none is shown.</p>
              )}
            </>
          )}
        />

        <Rows
          title="Pricing notes"
          hint="The competitor's published prices, worded as it publishes them, with the page you read them on."
          items={pricing}
          onChange={setPricing}
          make={emptyPricing}
          addLabel="Add pricing note"
          itemName="pricing"
          render={(item, update, index) => (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id={`p-${index}-plan`} label="Plan">
                  <Input id={`p-${index}-plan`} value={item.plan} onChange={(e) => update({ plan: e.target.value })} maxLength={100} />
                </Field>
                <Field id={`p-${index}-price`} label="Price as published">
                  <Input id={`p-${index}-price`} value={item.price} onChange={(e) => update({ price: e.target.value })} maxLength={100} />
                </Field>
                <div className="sm:col-span-2">
                  <Field id={`p-${index}-notes`} label="Notes (optional)">
                    <Input id={`p-${index}-notes`} value={item.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} maxLength={300} />
                  </Field>
                </div>
              </div>
              <Evidence prefix="p" index={index} sourceUrl={item.sourceUrl} sourceDate={item.sourceDate} onChange={update} required />
            </>
          )}
        />

        <Rows
          title="Differences"
          hint="Concrete, checkable differences in what each product does."
          items={differences}
          onChange={setDifferences}
          make={emptyDifference}
          addLabel="Add difference"
          itemName="difference"
          render={(item, update, index) => (
            <>
              <Field id={`d-${index}-title`} label="Title">
                <Input id={`d-${index}-title`} value={item.title} onChange={(e) => update({ title: e.target.value })} maxLength={120} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id={`d-${index}-comp`} label="What the competitor does">
                  <Textarea id={`d-${index}-comp`} rows={3} value={item.competitor} onChange={(e) => update({ competitor: e.target.value })} maxLength={500} />
                </Field>
                <Field id={`d-${index}-jp`} label="What JobPilot AI does">
                  <Textarea id={`d-${index}-jp`} rows={3} value={item.jobpilot} onChange={(e) => update({ jobpilot: e.target.value })} maxLength={500} />
                </Field>
              </div>
              <Evidence prefix="d" index={index} sourceUrl={item.sourceUrl} sourceDate={item.sourceDate} onChange={update} required />
            </>
          )}
        />

        <Rows
          title="FAQs"
          hint="Shown on the page and as FAQ structured data. Add a source only when an answer states a fact about the competitor."
          items={faqs}
          onChange={setFaqs}
          make={emptyFaq}
          addLabel="Add FAQ"
          itemName="faq"
          render={(item, update, index) => (
            <>
              <Field id={`q-${index}-q`} label="Question">
                <Input id={`q-${index}-q`} value={item.question} onChange={(e) => update({ question: e.target.value })} maxLength={200} />
              </Field>
              <Field id={`q-${index}-a`} label="Answer">
                <Textarea id={`q-${index}-a`} rows={3} value={item.answer} onChange={(e) => update({ answer: e.target.value })} maxLength={1000} />
              </Field>
              <Evidence prefix="q" index={index} sourceUrl={item.sourceUrl} sourceDate={item.sourceDate} onChange={update} required={false} />
            </>
          )}
        />

        <Field id="c-publish" label="Publish at (UK time, optional)">
          <Input id="c-publish" name="publishAt" type="datetime-local" />
          <p className="text-xs text-muted-foreground">Blank keeps it as it is (a new page stays a draft). Use the Publish button on the list to publish now. A page can only go live with a source for every competitor claim.</p>
        </Field>

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2Icon className="size-4 animate-spin" /> Saving…
              </>
            ) : isEditing ? (
              "Save comparison"
            ) : (
              "Create comparison"
            )}
          </Button>
          <Button type="button" variant="outline" render={<a href="/admin/compare">Cancel</a>} />
        </div>
      </form>
    </Card>
  );
}
