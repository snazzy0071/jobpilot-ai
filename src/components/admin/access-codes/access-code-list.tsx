"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { setAccessCodeActive } from "@/lib/admin/access-codes/actions";
import type { AdminAccessCode } from "@/lib/admin/access-codes/types";

function ToggleActiveButton({ code }: { code: AdminAccessCode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const formData = new FormData();
    formData.set("id", code.id);
    formData.set("isActive", (!code.isActive).toString());
    const result = await setAccessCodeActive(undefined, formData);
    setPending(false);
    if (result && "error" in result) {
      window.alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
      {code.isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}

export function AccessCodeList({ codes }: { codes: AdminAccessCode[] }) {
  if (codes.length === 0) {
    return (
      <Card className="items-center gap-2 p-10 text-center text-sm text-muted-foreground">No access codes yet.</Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Label</TableHead>
          <TableHead>Redemptions</TableHead>
          <TableHead>Grants</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {codes.map((code) => (
          <TableRow key={code.id}>
            <TableCell className="font-mono text-sm font-medium">{code.code}</TableCell>
            <TableCell>
              <p className="text-sm">{code.label}</p>
              {code.institutionName && <p className="text-xs text-muted-foreground">{code.institutionName}</p>}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {code.redemptionCount}
              {code.maxRedemptions ? ` / ${code.maxRedemptions}` : ""}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{code.grantedPlanSlug ?? "—"}</TableCell>
            <TableCell>
              <Badge variant={code.isActive ? "tinted" : "secondary"}>{code.isActive ? "Active" : "Inactive"}</Badge>
            </TableCell>
            <TableCell>
              <div className="flex justify-end">
                <ToggleActiveButton code={code} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
