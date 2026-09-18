"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createQuestion, updateQuestion } from "@/lib/test-prep/admin/actions";
import { QUESTION_TYPES, QUESTION_DIFFICULTIES, type QuestionType } from "@/lib/test-prep/types";
import type { AdminQuestion } from "@/lib/test-prep/admin/types";

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True / False",
  free_text: "Free text (ungraded)",
};

const NO_DIFFICULTY = "__none__";

/**
 * `correctAnswer`/`explanation` are shown here because this is the
 * admin-only editor — src/lib/test-prep/admin/queries.ts's own header
 * comment covers why fetching them at all requires the service-role
 * client, the one thing this form's actions (createQuestion/
 * updateQuestion) actually use.
 */
export function QuestionForm({ questionPackId, question }: { questionPackId: string; question?: AdminQuestion }) {
  const router = useRouter();
  const isEditing = !!question;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionType, setQuestionType] = useState<QuestionType>(question?.questionType ?? "multiple_choice");
  const [difficulty, setDifficulty] = useState(question?.difficulty ?? NO_DIFFICULTY);
  const [isActive, setIsActive] = useState(question?.isActive ?? true);

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
    <Card className="p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input type="hidden" name="questionPackId" value={questionPackId} />
        {isEditing && <input type="hidden" name="id" value={question.id} />}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q-prompt">Prompt</Label>
          <Textarea id="q-prompt" name="prompt" rows={4} maxLength={4000} defaultValue={question?.prompt} required />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-type">Question type</Label>
            <Select name="questionType" value={questionType} onValueChange={(value) => value && setQuestionType(value as QuestionType)}>
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
            <Select name="difficulty" value={difficulty} onValueChange={(value) => value && setDifficulty(value)}>
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
            <Label htmlFor="q-subtype">Subtype (optional)</Label>
            <Input id="q-subtype" name="subtype" defaultValue={question?.subtype ?? ""} maxLength={100} placeholder="e.g. Percentages" />
          </div>
        </div>

        {questionType !== "free_text" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-options">
              Options{questionType === "multiple_choice" ? " (one per line, at least two)" : " (one per line)"}
            </Label>
            <Textarea
              id="q-options"
              name="options"
              rows={4}
              maxLength={4000}
              defaultValue={question?.options.join("\n") ?? (questionType === "true_false" ? "True\nFalse" : "")}
              placeholder={"Option A\nOption B\nOption C"}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q-correct-answer">
            Correct answer{questionType === "free_text" ? " (optional — leave blank if ungraded)" : ""}
          </Label>
          <Input
            id="q-correct-answer"
            name="correctAnswer"
            defaultValue={question?.correctAnswer ?? ""}
            maxLength={500}
            placeholder={questionType === "multiple_choice" ? "Must exactly match one of the options above" : undefined}
            required={questionType !== "free_text"}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q-explanation">Explanation (optional)</Label>
          <Textarea id="q-explanation" name="explanation" rows={3} maxLength={2000} defaultValue={question?.explanation ?? ""} />
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
  );
}
