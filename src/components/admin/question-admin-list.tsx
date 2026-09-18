"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { deleteQuestion } from "@/lib/test-prep/admin/actions";
import type { AdminQuestion } from "@/lib/test-prep/admin/types";

const DIFFICULTY_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  easy: "secondary",
  medium: "default",
  hard: "destructive",
};

function DeleteButton({ id, prompt }: { id: string; prompt: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete this question? This can't be undone.\n\n"${prompt.slice(0, 80)}"`)) return;
    setDeleting(true);
    const formData = new FormData();
    formData.set("id", id);
    const result = await deleteQuestion(undefined, formData);
    if (result && "error" in result) {
      setDeleting(false);
      window.alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label="Delete question" onClick={handleDelete} disabled={deleting}>
      {deleting ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}

export function QuestionAdminList({ questions }: { questions: AdminQuestion[] }) {
  if (questions.length === 0) {
    return (
      <Card className="items-center gap-2 p-10 text-center">
        <p className="font-medium">No questions yet</p>
        <p className="text-sm text-muted-foreground">Add one to start building out this pack.</p>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Prompt</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Difficulty</TableHead>
          <TableHead>Subtype</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {questions.map((question) => (
          <TableRow key={question.id}>
            <TableCell className="text-sm text-muted-foreground">{question.displayOrder}</TableCell>
            <TableCell className="max-w-md">
              <Link href={`/admin/test-prep/questions/${question.id}/edit`} className="line-clamp-2 hover:underline">
                {question.prompt}
              </Link>
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
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Edit question"
                  render={<Link href={`/admin/test-prep/questions/${question.id}/edit`} />}
                >
                  <Pencil className="size-4" />
                </Button>
                <DeleteButton id={question.id} prompt={question.prompt} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
