import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { NativeSelect } from "@/components/ui/native-select";
import { listAdminEmailLogs, listEmailTemplates } from "@/lib/admin/email-logs/queries";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function AdminEmailLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; status?: string }>;
}) {
  const params = await searchParams;
  const filters = {
    template: params.template || undefined,
    status: (params.status as "sent" | "failed") || undefined,
  };
  const [entries, templates] = await Promise.all([listAdminEmailLogs(filters), listEmailTemplates()]);

  return (
    <div className="flex flex-col gap-6">
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="template" className="text-sm font-medium">
            Template
          </label>
          <NativeSelect
            id="template"
            name="template"
            defaultValue={params.template ?? ""}
          >
            <option value="">Any template</option>
            {templates.map((template) => (
              <option key={template} value={template}>
                {template}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <NativeSelect
            id="status"
            name="status"
            defaultValue={params.status ?? ""}
          >
            <option value="">Any status</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </NativeSelect>
        </div>
        <Button type="submit">Filter</Button>
        {(params.template || params.status) && <Button type="button" variant="ghost" render={<Link href="/admin/email-logs">Clear</Link>} />}
      </form>

      {entries.length === 0 ? (
        <Card className="items-center gap-2 p-10 text-center text-sm text-muted-foreground">No email log entries match these filters.</Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-sm">{entry.recipient}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{entry.template}</TableCell>
                <TableCell>
                  <Badge variant={entry.status === "sent" ? "tinted" : "destructive"}>{entry.status}</Badge>
                  {entry.errorName && <span className="ml-1 text-xs text-muted-foreground">{entry.errorName}</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{entry.attempts}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDateTime(entry.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
