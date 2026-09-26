"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircleIcon, Bell, Check, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { completeReminder } from "@/lib/applications/reminders/actions";
import type { DueReminder } from "@/lib/applications/reminders/queries";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** The in-app channel of reminders: everything that has come due and isn't done, at the top of the tracker where you'll see it. */
export function DueReminders({ reminders: initial }: { reminders: DueReminder[] }) {
  const [reminders, setReminders] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (reminders.length === 0) return null;

  async function handleDone(id: string) {
    setBusyId(id);
    setError(null);
    const formData = new FormData();
    formData.set("id", id);
    const result = await completeReminder(undefined, formData);
    setBusyId(null);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    setReminders((prev) => prev.filter((reminder) => reminder.id !== id));
  }

  return (
    <Card className="gap-3 border-primary/30 bg-primary/5 p-4" role="region" aria-label="Reminders due" data-testid="due-reminders">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <Bell className="size-4" aria-hidden="true" /> {reminders.length} reminder{reminders.length === 1 ? "" : "s"} due
      </h2>
      <ul className="flex flex-col gap-2">
        {reminders.map((reminder) => (
          <li key={reminder.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{reminder.message}</p>
              <p className="text-xs text-muted-foreground">
                <Link href={`/dashboard/applications/${reminder.applicationId}/edit`} className="underline-offset-4 hover:underline">
                  {reminder.jobTitle} at {reminder.companyName}
                </Link>{" "}
                · was due {formatDateTime(reminder.remindAt)}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => handleDone(reminder.id)} disabled={busyId === reminder.id}>
              {busyId === reminder.id ? <Loader2Icon className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Mark done
            </Button>
          </li>
        ))}
      </ul>
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircleIcon className="size-4 shrink-0" /> {error}
        </p>
      )}
    </Card>
  );
}
