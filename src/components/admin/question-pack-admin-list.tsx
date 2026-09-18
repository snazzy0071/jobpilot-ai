"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { deleteQuestionPack } from "@/lib/test-prep/admin/actions";
import type { AdminQuestionPack } from "@/lib/test-prep/admin/types";

function DeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete "${name}"? This also deletes every question in it. This can't be undone.`)) return;
    setDeleting(true);
    const formData = new FormData();
    formData.set("id", id);
    const result = await deleteQuestionPack(undefined, formData);
    if (result && "error" in result) {
      setDeleting(false);
      window.alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${name}`} onClick={handleDelete} disabled={deleting}>
      {deleting ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}

export function QuestionPackAdminList({ packs, questionCounts }: { packs: AdminQuestionPack[]; questionCounts: Record<string, number> }) {
  if (packs.length === 0) {
    return (
      <Card className="items-center gap-2 p-10 text-center">
        <p className="font-medium">No packs yet</p>
        <p className="text-sm text-muted-foreground">Add one to start adding questions under this test type.</p>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Sector style</TableHead>
          <TableHead>Questions</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {packs.map((pack) => (
          <TableRow key={pack.id}>
            <TableCell>
              <Link href={`/admin/test-prep/packs/${pack.id}`} className="font-medium hover:underline">
                {pack.name}
              </Link>
              <p className="text-sm text-muted-foreground">{pack.slug}</p>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{pack.sectorStyle ?? "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{questionCounts[pack.id] ?? 0}</TableCell>
            <TableCell>
              <Badge variant={pack.isActive ? "tinted" : "outline"}>{pack.isActive ? "Active" : "Inactive"}</Badge>
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${pack.name}`} render={<Link href={`/admin/test-prep/packs/${pack.id}/edit`} />}>
                  <Pencil className="size-4" />
                </Button>
                <DeleteButton id={pack.id} name={pack.name} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
