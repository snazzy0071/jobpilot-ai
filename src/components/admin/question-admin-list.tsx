"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyIcon, EyeIcon, EyeOffIcon, Loader2Icon, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { deleteQuestion, duplicateQuestion, setQuestionActive } from "@/lib/test-prep/admin/actions";
import type { AdminQuestion } from "@/lib/test-prep/admin/types";

const DIFFICULTY_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  easy: "secondary",
  medium: "default",
  hard: "destructive",
};

const ALL = "__all__";
const DIFFICULTY_FILTER_ITEMS: Record<string, string> = { [ALL]: "Any difficulty", easy: "Easy", medium: "Medium", hard: "Hard" };
const STATUS_FILTER_ITEMS: Record<string, string> = { [ALL]: "Any status", active: "Active", inactive: "Inactive" };

/** One row's actions. Failures are shown inline (announced to screen readers) rather than in a blocking browser alert. */
function RowActions({ question, onError }: { question: AdminQuestion; onError: (message: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"delete" | "toggle" | "duplicate" | null>(null);

  async function run(kind: "delete" | "toggle" | "duplicate", action: () => Promise<{ error: string } | unknown>) {
    setBusy(kind);
    onError("");
    const result = await action();
    setBusy(null);
    if (result && typeof result === "object" && "error" in result) {
      onError((result as { error: string }).error);
      return;
    }
    router.refresh();
  }

  function handleDelete() {
    if (!window.confirm(`Delete this question? This can't be undone.\n\n"${question.prompt.slice(0, 80)}"`)) return;
    const formData = new FormData();
    formData.set("id", question.id);
    void run("delete", () => deleteQuestion(undefined, formData));
  }

  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={question.isActive ? "Deactivate question" : "Activate question"}
        title={question.isActive ? "Hide from learners" : "Show to learners"}
        disabled={busy !== null}
        onClick={() => void run("toggle", () => setQuestionActive({ id: question.id, isActive: !question.isActive }))}
      >
        {busy === "toggle" ? <Loader2Icon className="size-4 animate-spin" /> : question.isActive ? <EyeIcon className="size-4" /> : <EyeOffIcon className="size-4" />}
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Duplicate question" title="Duplicate (as inactive)" disabled={busy !== null} onClick={() => void run("duplicate", () => duplicateQuestion({ id: question.id }))}>
        {busy === "duplicate" ? <Loader2Icon className="size-4 animate-spin" /> : <CopyIcon className="size-4" />}
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Edit question" render={<Link href={`/admin/test-prep/questions/${question.id}/edit`} />}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Delete question" onClick={handleDelete} disabled={busy !== null}>
        {busy === "delete" ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
    </div>
  );
}

export function QuestionAdminList({ questions }: { questions: AdminQuestion[] }) {
  const [search, setSearch] = useState("");
  const [subtype, setSubtype] = useState(ALL);
  const [difficulty, setDifficulty] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [error, setError] = useState("");

  const subtypes = useMemo(() => [...new Set(questions.map((question) => question.subtype).filter((value): value is string => !!value))].sort(), [questions]);
  const subtypeItems = useMemo(() => ({ [ALL]: "Any topic", ...Object.fromEntries(subtypes.map((value) => [value, value])) }) as Record<string, string>, [subtypes]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return questions.filter((question) => {
      if (subtype !== ALL && question.subtype !== subtype) return false;
      if (difficulty !== ALL && question.difficulty !== difficulty) return false;
      if (status === "active" && !question.isActive) return false;
      if (status === "inactive" && question.isActive) return false;
      if (needle && !`${question.prompt} ${question.stimulus ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [questions, search, subtype, difficulty, status]);

  if (questions.length === 0) {
    return (
      <Card className="items-center gap-2 p-10 text-center">
        <p className="font-medium">No questions yet</p>
        <p className="text-sm text-muted-foreground">Add one, or import a batch from JSON, to start building out this pack.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="qf-search">Search</Label>
          <Input id="qf-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Words in the prompt or passage" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="qf-subtype">Topic</Label>
          <Select items={subtypeItems} value={subtype} onValueChange={(value) => value && setSubtype(value)}>
            <SelectTrigger id="qf-subtype" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any topic</SelectItem>
              {subtypes.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="qf-difficulty">Difficulty</Label>
          <Select items={DIFFICULTY_FILTER_ITEMS} value={difficulty} onValueChange={(value) => value && setDifficulty(value)}>
            <SelectTrigger id="qf-difficulty" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DIFFICULTY_FILTER_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="qf-status">Status</Label>
          <Select items={STATUS_FILTER_ITEMS} value={status} onValueChange={(value) => value && setStatus(value)}>
            <SelectTrigger id="qf-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_FILTER_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground" role="status" data-testid="question-count">
        Showing {visible.length} of {questions.length} question{questions.length === 1 ? "" : "s"}.
      </p>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <Card className="items-center p-8 text-center text-sm text-muted-foreground">No questions match those filters.</Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Prompt</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((question) => (
              <TableRow key={question.id} data-testid="admin-question-row">
                <TableCell className="text-sm text-muted-foreground">{question.displayOrder}</TableCell>
                <TableCell className="max-w-md">
                  <Link href={`/admin/test-prep/questions/${question.id}/edit`} className="line-clamp-2 hover:underline">
                    {question.prompt}
                  </Link>
                  {(question.exhibit || question.optionFigures) && <p className="text-xs text-muted-foreground">{question.optionFigures ? "Diagram options" : "Has exhibit"}</p>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{question.questionType.replace("_", " ")}</TableCell>
                <TableCell>
                  {question.difficulty ? (
                    <Badge variant={DIFFICULTY_VARIANT[question.difficulty] ?? "outline"}>{question.difficulty}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{question.subtype ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={question.isActive ? "tinted" : "outline"}>{question.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>
                  <RowActions question={question} onError={setError} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
