"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { deleteUserAccountByAdmin, deleteUsersAccountsByAdmin, type BulkDeleteUsersResult } from "@/lib/admin/users/actions";
import type { AdminUserListItem } from "@/lib/admin/users/types";

function planStatusLabel(status: string | null, planSlug: string): string {
  if (!status) return "Free";
  return `${planSlug} · ${status}`;
}

function RoleBadge({ role }: { role: AdminUserListItem["role"] }) {
  if (role === "admin") return <Badge variant="tinted">{role}</Badge>;
  // A distinct, brand-secondary (green) tint — not the same tone as "admin" — so the three roles read as three
  // genuinely different states at a glance, not two greys and one accent.
  if (role === "institution_admin") {
    return <Badge className="border-brand-secondary/20 bg-brand-secondary/12 text-brand-secondary">{role}</Badge>;
  }
  return <Badge variant="outline">{role}</Badge>;
}

/**
 * Split from its trigger (RowDeleteButton below) the same way CvCard's DeleteAlert is split from CvCard's own
 * trigger button — `onOpenChange` here is a prop, not the local `useState` setter directly, which is what a
 * plain `useEffect` is allowed to call on completion (calling a `useState` setter it owns *itself* inside an
 * effect is what the react-hooks/set-state-in-effect rule flags; calling a callback prop isn't, since the effect
 * has no way of knowing what that prop actually does).
 */
function RowDeleteDialog({ userId, label, open, onOpenChange }: { userId: string; label: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(deleteUserAccountByAdmin, undefined);

  useEffect(() => {
    if (state === undefined) return; // initial state, not a completed submit
    if (state && "error" in state) return; // stays open, error shown inline below
    onOpenChange(false);
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}&rsquo;s account?</AlertDialogTitle>
          <AlertDialogDescription>This permanently deletes the account and everything in it. This can&apos;t be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        {state && "error" in state && (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="userId" value={userId} />
            <AlertDialogAction type="submit" variant="destructive" disabled={pending}>
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Per-row delete — same guarded server action the user detail page's danger zone uses, just reachable without navigating in first. A real styled AlertDialog, not a native window.confirm(). */
function RowDeleteButton({ userId, label }: { userId: string; label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label={`Delete ${label}`}>
        <Trash2Icon className="size-4 text-destructive" />
      </Button>
      <RowDeleteDialog userId={userId} label={label} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Bulk "Delete selected" — same styled-dialog treatment, plus an in-dialog result view (deleted/skipped counts) instead of a native alert() once the action completes. */
function BulkDeleteDialog({
  open,
  onOpenChange,
  selectedIds,
  onDone,
  formAction,
  pending,
  state,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Set<string>;
  onDone: () => void;
  formAction: (formData: FormData) => void;
  pending: boolean;
  state: BulkDeleteUsersResult | undefined;
}) {
  const result = state && "deletedCount" in state ? state : null;
  const count = selectedIds.size;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {result ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Deleted {result.deletedCount} account{result.deletedCount === 1 ? "" : "s"}
              </AlertDialogTitle>
              {result.skipped.length > 0 && (
                <AlertDialogDescription>
                  Skipped {result.skipped.length} account{result.skipped.length === 1 ? "" : "s"}: {result.skipped.map((s) => s.reason).join("; ")}.
                </AlertDialogDescription>
              )}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction type="button" onClick={onDone}>
                Close
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {count} account{count === 1 ? "" : "s"}?
              </AlertDialogTitle>
              <AlertDialogDescription>This permanently deletes every selected account and everything in it. This can&apos;t be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            {state && "error" in state && (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <form action={formAction}>
                {[...selectedIds].map((id) => (
                  <input key={id} type="hidden" name="userIds" value={id} />
                ))}
                <AlertDialogAction type="submit" variant="destructive" disabled={pending}>
                  {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  {pending ? "Deleting…" : "Delete selected"}
                </AlertDialogAction>
              </form>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function UsersTable({ users }: { users: AdminUserListItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkState, bulkFormAction, bulkPending] = useActionState(deleteUsersAccountsByAdmin, undefined);

  const allSelected = users.length > 0 && selected.size === users.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(users.map((user) => user.id)) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleBulkDone() {
    setBulkOpen(false);
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5">
          <p className="text-sm font-medium">
            {selected.size} account{selected.size === 1 ? "" : "s"} selected
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => setBulkOpen(true)}>
              <Trash2Icon className="size-4" />
              Delete selected
            </Button>
          </div>
        </div>
      )}

      <BulkDeleteDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        selectedIds={selected}
        onDone={handleBulkDone}
        formAction={bulkFormAction}
        pending={bulkPending}
        state={bulkState}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={(checked) => toggleAll(checked === true)}
                aria-label="Select all accounts"
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Delete</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const label = user.fullName ?? user.email ?? "this account";
            const isSelected = selected.has(user.id);
            return (
              <TableRow key={user.id} data-state={isSelected ? "selected" : undefined}>
                <TableCell>
                  <Checkbox checked={isSelected} onCheckedChange={(checked) => toggleOne(user.id, checked === true)} aria-label={`Select ${label}`} />
                </TableCell>
                <TableCell>
                  <Link href={`/admin/users/${user.id}`} className="font-medium hover:underline">
                    {user.fullName ?? "—"}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.email ?? "—"}</TableCell>
                <TableCell>
                  <RoleBadge role={user.role} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{planStatusLabel(user.subscriptionStatus, user.planSlug)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(user.createdAt).toLocaleDateString("en-GB")}</TableCell>
                <TableCell>
                  <RowDeleteButton userId={user.id} label={label} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
