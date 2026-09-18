"use client";

import { useState } from "react";
import { AlertCircleIcon, Bell, Check, Loader2Icon, Mail, Monitor, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { createReminder, completeReminder, deleteReminder } from "@/lib/applications/reminders/actions";
import type { ApplicationReminder, ReminderDeliveryStatus } from "@/lib/applications/types";

const STATUS_LABEL: Record<ReminderDeliveryStatus, string> = {
  pending: "Scheduled",
  sent: "Sent",
  failed: "Failed",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

function ChannelBadge({ icon: Icon, label, status }: { icon: typeof Mail; label: string; status: ReminderDeliveryStatus | null }) {
  if (!status) return null;
  const variant = status === "sent" ? "tinted" : status === "failed" ? "destructive" : "outline";
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="size-3" />
      {label}: {STATUS_LABEL[status]}
    </Badge>
  );
}

function ReminderRow({ reminder, onChanged }: { reminder: ApplicationReminder; onChanged: (updated: ApplicationReminder | null) => void }) {
  const [pending, setPending] = useState(false);

  async function handleComplete() {
    setPending(true);
    const formData = new FormData();
    formData.set("id", reminder.id);
    const result = await completeReminder(undefined, formData);
    setPending(false);
    if (result && "error" in result) {
      window.alert(result.error);
      return;
    }
    onChanged({ ...reminder, completedAt: new Date().toISOString() });
  }

  async function handleDelete() {
    if (!window.confirm("Delete this reminder?")) return;
    setPending(true);
    const formData = new FormData();
    formData.set("id", reminder.id);
    const result = await deleteReminder(undefined, formData);
    setPending(false);
    if (result && "error" in result) {
      window.alert(result.error);
      return;
    }
    onChanged(null);
  }

  // Date.now() is impure — captured once via a lazy initializer instead
  // of called directly in the render body (React's own purity rule),
  // which is fine here: "overdue" only needs to be accurate to roughly
  // when this card mounted, not to the millisecond on every re-render.
  const [nowMs] = useState(() => Date.now());
  const overdue = !reminder.completedAt && new Date(reminder.remindAt).getTime() < nowMs;

  return (
    <Card className={`gap-2 p-3 ${reminder.completedAt ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{reminder.message}</p>
          <p className={`text-xs ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
            {overdue ? "Overdue — " : ""}
            {formatDateTime(reminder.remindAt)}
          </p>
        </div>
        <div className="flex gap-1">
          {!reminder.completedAt && (
            <Button variant="ghost" size="icon-sm" aria-label="Mark reminder done" onClick={handleComplete} disabled={pending}>
              <Check className="size-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Delete reminder" onClick={handleDelete} disabled={pending}>
            {pending ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <ChannelBadge icon={Mail} label="Email" status={reminder.emailStatus} />
        <ChannelBadge icon={Monitor} label="In-app" status={reminder.inAppStatus} />
        {reminder.completedAt && (
          <Badge variant="secondary" className="gap-1">
            <Check className="size-3" /> Done
          </Badge>
        )}
      </div>
      {reminder.emailError && <p className="text-xs text-destructive">Email failed: {reminder.emailError}</p>}
    </Card>
  );
}

/**
 * Deadline/follow-up reminders for one application — configurable
 * date/time (a real `datetime-local` input, not just a date) and
 * either/both delivery channels. Delivery itself never happens from
 * this component or any Server Action it calls: `GET /api/cron/
 * dispatch-reminders` (src/lib/applications/reminders/dispatch.ts) is
 * the only thing that ever sends an email or flips a channel to
 * 'sent' — this UI only creates the reminder request and displays
 * whatever state that job has recorded.
 */
export function ApplicationReminders({ applicationId, reminders: initialReminders }: { applicationId: string; reminders: ApplicationReminder[] }) {
  const [reminders, setReminders] = useState(initialReminders);
  const [remindAt, setRemindAt] = useState("");
  const [message, setMessage] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [sendInApp, setSendInApp] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChanged(id: string, updated: ApplicationReminder | null) {
    setReminders((prev) => (updated ? prev.map((reminder) => (reminder.id === id ? updated : reminder)) : prev.filter((reminder) => reminder.id !== id)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const result = await createReminder(formData);
    setLoading(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }
    setReminders((prev) => [...prev, result.reminder].sort((a, b) => a.remindAt.localeCompare(b.remindAt)));
    setRemindAt("");
    setMessage("");
    setSendEmail(false);
    setSendInApp(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <Bell className="size-4" /> Reminders
      </h2>

      {reminders.length > 0 && (
        <div className="flex flex-col gap-2">
          {reminders.map((reminder) => (
            <ReminderRow key={reminder.id} reminder={reminder} onChanged={(updated) => handleChanged(reminder.id, updated)} />
          ))}
        </div>
      )}

      <Card className="p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="applicationId" value={applicationId} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reminder-at">Date &amp; time</Label>
              <Input
                id="reminder-at"
                name="remindAt"
                type="datetime-local"
                value={remindAt}
                onChange={(event) => setRemindAt(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reminder-message">Message</Label>
              <Textarea
                id="reminder-message"
                name="message"
                rows={1}
                maxLength={500}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="e.g. Follow up if no reply"
                required
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox id="reminder-email" name="sendEmail" value="on" checked={sendEmail} onCheckedChange={(checked) => setSendEmail(checked === true)} />
              <Label htmlFor="reminder-email" className="text-sm font-normal">
                Email me
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="reminder-in-app" name="sendInApp" value="on" checked={sendInApp} onCheckedChange={(checked) => setSendInApp(checked === true)} />
              <Label htmlFor="reminder-in-app" className="text-sm font-normal">
                Show in-app
              </Label>
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
              <AlertCircleIcon className="size-4 shrink-0" /> {error}
            </p>
          )}

          <Button type="submit" variant="outline" size="sm" disabled={loading} className="self-start">
            {loading ? (
              <>
                <Loader2Icon className="size-3.5 animate-spin" /> Adding…
              </>
            ) : (
              "Add reminder"
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
