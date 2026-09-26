"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuestionBody } from "@/components/test-prep/question-body";
import { createQuestion, updateQuestion } from "@/lib/test-prep/admin/actions";
import { exhibitSchema, optionFiguresSchema } from "@/lib/test-prep/exhibit";
import { QUESTION_TYPES, QUESTION_DIFFICULTIES, type Question, type QuestionType } from "@/lib/test-prep/types";
import type { AdminQuestion } from "@/lib/test-prep/admin/types";

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True / False",
  free_text: "Free text (ungraded)",
};
const QUESTION_TYPE_ITEMS = QUESTION_TYPE_LABELS as Record<string, string>;

const NO_DIFFICULTY = "__none__";
const DIFFICULTY_ITEMS: Record<string, string> = { [NO_DIFFICULTY]: "Not set", easy: "Easy", medium: "Medium", hard: "Hard" };

const EXHIBIT_EXAMPLE = `{"kind":"table","caption":"Revenue by region (£000)","headers":["Region","Revenue"],"rows":[["North","120"],["South","180"]]}`;

/** Parses a JSON box for the live preview: empty -> nothing to show, invalid -> a message, valid -> the value. */
function tryParse<T>(text: string, schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string; path: PropertyKey[] }[] } } }): { value: T | null; error: string | null } {
  if (!text.trim()) return { value: null, error: null };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { value: null, error: "Not valid JSON yet." };
  }
  const result = schema.safeParse(json);
  if (!result.success) return { value: null, error: `${result.error.issues[0].path.join(".") || "value"}: ${result.error.issues[0].message}` };
  return { value: result.data, error: null };
}

/**
 * The admin question editor. `correctAnswer`/`explanation` are shown here because this is the admin-only editor (fetching
 * them needs the service-role client — see src/lib/test-prep/admin/queries.ts). The Exhibit and Option figures boxes take
 * the JSON documented in src/lib/test-prep/exhibit.ts (a table, a bar chart, or shapes); a live preview below renders the
 * question exactly as a learner will see it, and says what's wrong with the JSON while you type.
 */
export function QuestionForm({ questionPackId, question, subtypeSuggestions = [] }: { questionPackId: string; question?: AdminQuestion; subtypeSuggestions?: string[] }) {
  const router = useRouter();
  const isEditing = !!question;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionType, setQuestionType] = useState<QuestionType>(question?.questionType ?? "multiple_choice");
  const [difficulty, setDifficulty] = useState(question?.difficulty ?? NO_DIFFICULTY);
  const [isActive, setIsActive] = useState(question?.isActive ?? true);

  const [stimulus, setStimulus] = useState(question?.stimulus ?? "");
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [options, setOptions] = useState(question?.options.join("\n") ?? (questionType === "true_false" ? "True\nFalse" : ""));
  const [correct, setCorrect] = useState(question?.correctAnswer ?? "");
  const [exhibitText, setExhibitText] = useState(question?.exhibit ? JSON.stringify(question.exhibit, null, 1) : "");
  const [figuresText, setFiguresText] = useState(question?.optionFigures ? JSON.stringify(question.optionFigures, null, 1) : "");

  const exhibit = useMemo(() => tryParse(exhibitText, exhibitSchema), [exhibitText]);
  const figures = useMemo(() => tryParse(figuresText, optionFiguresSchema), [figuresText]);
  const optionList = useMemo(() => options.split("\n").map((option) => option.trim()).filter(Boolean), [options]);

  const preview: Question | null = useMemo(() => {
    if (!prompt.trim()) return null;
    return {
      id: "preview",
      questionPackId,
      questionType,
      stimulus: stimulus.trim() || null,
      prompt,
      options: optionList,
      exhibit: exhibit.value,
      optionFigures: figures.value && figures.value.length === optionList.length ? figures.value : null,
      difficulty: difficulty === NO_DIFFICULTY ? null : (difficulty as Question["difficulty"]),
      subtype: null,
      displayOrder: 0,
      isActive,
    };
  }, [prompt, stimulus, optionList, exhibit.value, figures.value, questionType, difficulty, isActive, questionPackId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = isEditing ? await updateQuestion(undefined, formData) : await createQuestion(formData);

    if (response && "error" in response) {
      setLoading(false);
      setError(response.error);
      return;
    }
    router.push(`/admin/test-prep/packs/${questionPackId}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="questionPackId" value={questionPackId} />
          {isEditing && <input type="hidden" name="id" value={question.id} />}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-stimulus">Passage / scenario (optional)</Label>
            <Textarea id="q-stimulus" name="stimulus" rows={4} maxLength={4000} value={stimulus} onChange={(event) => setStimulus(event.target.value)} placeholder="The text the question is about. Every question carries its own — never write 'see the passage above'." />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-prompt">Prompt</Label>
            <Textarea id="q-prompt" name="prompt" rows={3} maxLength={4000} value={prompt} onChange={(event) => setPrompt(event.target.value)} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="q-type">Question type</Label>
              <Select name="questionType" items={QUESTION_TYPE_ITEMS} value={questionType} onValueChange={(value) => value && setQuestionType(value as QuestionType)}>
                <SelectTrigger id="q-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {QUESTION_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="q-difficulty">Difficulty (optional)</Label>
              <Select name="difficulty" items={DIFFICULTY_ITEMS} value={difficulty} onValueChange={(value) => value && setDifficulty(value)}>
                <SelectTrigger id="q-difficulty" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DIFFICULTY}>Not set</SelectItem>
                  {QUESTION_DIFFICULTIES.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level[0].toUpperCase() + level.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="q-subtype">Topic / subtype (optional)</Label>
              <Input id="q-subtype" name="subtype" list="q-subtype-list" defaultValue={question?.subtype ?? ""} maxLength={100} placeholder="e.g. Percentages" />
              <datalist id="q-subtype-list">
                {subtypeSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">Accuracy and weak areas are tracked per topic — reuse an existing one so results group together.</p>
            </div>
          </div>

          {questionType !== "free_text" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="q-options">Options{questionType === "multiple_choice" ? " (one per line, at least two)" : " (one per line)"}</Label>
              <Textarea id="q-options" name="options" rows={4} maxLength={4000} value={options} onChange={(event) => setOptions(event.target.value)} placeholder={"Option A\nOption B\nOption C"} />
              <p className="text-xs text-muted-foreground">For a diagrammatic question use labels (A, B, C, D, E) and put a picture for each in “Option figures”.</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-correct-answer">Correct answer{questionType === "free_text" ? " (optional — leave blank if ungraded)" : ""}</Label>
            <Input
              id="q-correct-answer"
              name="correctAnswer"
              value={correct}
              onChange={(event) => setCorrect(event.target.value)}
              maxLength={500}
              placeholder={questionType === "multiple_choice" ? "Must exactly match one of the options above" : undefined}
              required={questionType !== "free_text"}
            />
            {questionType !== "free_text" && correct && optionList.length > 0 && !optionList.includes(correct) && (
              <p className="text-xs text-destructive" role="status">
                That doesn&apos;t exactly match any option yet.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-explanation">Explanation (shown after answering)</Label>
            <Textarea id="q-explanation" name="explanation" rows={3} maxLength={2000} defaultValue={question?.explanation ?? ""} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-exhibit">Exhibit — table, bar chart or shapes (optional JSON)</Label>
            <Textarea id="q-exhibit" name="exhibit" rows={5} className="font-mono text-xs" maxLength={20000} value={exhibitText} onChange={(event) => setExhibitText(event.target.value)} placeholder={EXHIBIT_EXAMPLE} />
            {exhibit.error && (
              <p className="text-xs text-destructive" role="status">
                {exhibit.error}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-figures">Option figures — one picture per option (optional JSON array)</Label>
            <Textarea id="q-figures" name="optionFigures" rows={4} className="font-mono text-xs" maxLength={20000} value={figuresText} onChange={(event) => setFiguresText(event.target.value)} placeholder='[[{"kind":"circle","fill":"black"}], [{"kind":"square"}]]' />
            {figures.error && (
              <p className="text-xs text-destructive" role="status">
                {figures.error}
              </p>
            )}
            {figures.value && figures.value.length !== optionList.length && (
              <p className="text-xs text-destructive" role="status">
                {figures.value.length} figures but {optionList.length} options — they must match one to one.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="q-display-order">Display order</Label>
              <Input id="q-display-order" name="displayOrder" type="number" min={0} defaultValue={question?.displayOrder ?? 0} />
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2">
                <Checkbox id="q-active" name="isActive" value="on" checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
                <Label htmlFor="q-active" className="text-sm font-normal">
                  Active (visible to practice-takers)
                </Label>
              </div>
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
              <AlertCircleIcon className="size-4 shrink-0" /> {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2Icon className="animate-spin" /> Saving…
                </>
              ) : isEditing ? (
                "Save changes"
              ) : (
                "Create question"
              )}
            </Button>
            <Button type="button" variant="outline" render={<a href={`/admin/test-prep/packs/${questionPackId}`}>Cancel</a>} />
          </div>
        </form>
      </Card>

      <section aria-labelledby="preview-heading" className="flex flex-col gap-2">
        <h2 id="preview-heading" className="text-sm font-semibold">
          Preview — as a learner sees it
        </h2>
        <Card className="p-6" data-testid="question-preview">
          {preview ? (
            <QuestionBody question={preview} index={0} total={1} value="" onChange={() => undefined} disabled reveal={correct && preview.questionType !== "free_text" ? { correctAnswer: correct, selectedAnswer: null } : null} />
          ) : (
            <p className="text-sm text-muted-foreground">Type a prompt to see the preview.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
