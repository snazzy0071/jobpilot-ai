"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { deleteTestType } from "@/lib/test-prep/admin/actions";
import type { AdminTestType } from "@/lib/test-prep/admin/types";

function DeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete "${name}"? This also deletes every pack and question under it. This can't be undone.`)) return;
    setDeleting(true);
    const formData = new FormData();
    formData.set("id", id);
    const result = await deleteTestType(undefined, formData);
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

export function TestTypeAdminList({ testTypes, packCounts }: { testTypes: AdminTestType[]; packCounts: Record<string, number> }) {
  if (testTypes.length === 0) {
    return (
      <Card className="items-center gap-2 p-10 text-center">
        <p className="font-medium">No test types yet</p>
        <p className="text-sm text-muted-foreground">Add one to start building out practice content.</p>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Packs</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {testTypes.map((testType) => (
          <TableRow key={testType.id}>
            <TableCell>
              <Link href={`/admin/test-prep/test-types/${testType.id}`} className="font-medium hover:underline">
                {testType.name}
              </Link>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{testType.slug}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{packCounts[testType.id] ?? 0}</TableCell>
            <TableCell>
              <Badge variant={testType.isActive ? "tinted" : "outline"}>{testType.isActive ? "Active" : "Inactive"}</Badge>
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${testType.name}`}
                  render={<Link href={`/admin/test-prep/test-types/${testType.id}/edit`} />}
                >
                  <Pencil className="size-4" />
                </Button>
                <DeleteButton id={testType.id} name={testType.name} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
