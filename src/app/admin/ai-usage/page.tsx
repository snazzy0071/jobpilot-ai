import Link from "next/link";
import { SparklesIcon, AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { getAiUsageDashboard } from "@/lib/admin/ai-usage/queries";
import type { AiUsageBreakdownRow, AiUsageUserBreakdownRow } from "@/lib/admin/ai-usage/types";

export const dynamic = "force-dynamic";

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function presetRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { from: formatDateOnly(from), to: formatDateOnly(to) };
}

function StatTile({ icon: Icon, label, value, caption }: { icon: typeof SparklesIcon; label: string; value: string; caption?: string }) {
  return (
    <Card className="gap-1 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-4" /> {label}
      </div>
      <p className="font-heading text-2xl font-semibold tracking-tight">{value}</p>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </Card>
  );
}

function FeatureModelTable({ title, rows }: { title: string; rows: AiUsageBreakdownRow[] }) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold tracking-tight">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No calls in this range.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Calls</TableHead>
              <TableHead>Success</TableHead>
              <TableHead>Tokens</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Avg latency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium">{row.key}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.calls.toLocaleString()}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.successRate !== null ? `${row.successRate}%` : "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.tokens.toLocaleString()}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatUsd(row.costUsd)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.avgLatencyMs !== null ? `${row.avgLatencyMs}ms` : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function UserTable({ rows }: { rows: AiUsageUserBreakdownRow[] }) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold tracking-tight">Top users by cost</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No calls in this range.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Calls</TableHead>
              <TableHead>Tokens</TableHead>
              <TableHead>Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.userId ?? "anonymous"}>
                <TableCell>
                  {row.userId ? (
                    <Link href={`/admin/users/${row.userId}`} className="font-medium hover:underline">
                      {row.email ?? row.userId}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Anonymous / unauthenticated</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.calls.toLocaleString()}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.tokens.toLocaleString()}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatUsd(row.costUsd)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default async function AdminAiUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const defaultRange = presetRange(7);
  const from = params.from || defaultRange.from;
  const to = params.to || defaultRange.to;

  const data = await getAiUsageDashboard({ from, to });

  const presets = [
    { label: "Today", ...presetRange(1) },
    { label: "7 days", ...presetRange(7) },
    { label: "30 days", ...presetRange(30) },
    { label: "90 days", ...presetRange(90) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">AI usage</h1>
        <p className="mt-1 text-muted-foreground">Real usage from `ai_usage_logs` — every call this app has made through the AI gateway, by feature, model, and user.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="from" className="text-sm font-medium">
              From
            </label>
            <Input id="from" name="from" type="date" defaultValue={from} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="to" className="text-sm font-medium">
              To
            </label>
            <Input id="to" name="to" type="date" defaultValue={to} />
          </div>
          <Button type="submit">Apply</Button>
        </form>
        <div className="flex flex-wrap gap-1">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              render={<Link href={`/admin/ai-usage?from=${preset.from}&to=${preset.to}`}>{preset.label}</Link>}
            />
          ))}
        </div>
      </div>

      {data.summary.truncated && (
        <Card className="flex-row items-center gap-2 p-3 text-sm text-muted-foreground">
          <AlertTriangleIcon className="size-4 shrink-0" /> This range has {data.summary.totalCalls.toLocaleString()} calls — cost, token, and
          latency figures below are based on the {data.summary.sampledRows.toLocaleString()} most recent. Narrow the date range for exact figures.
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={SparklesIcon} label="Total calls" value={data.summary.totalCalls.toLocaleString()} />
        <StatTile icon={SparklesIcon} label="Success rate" value={data.summary.successRate !== null ? `${data.summary.successRate}%` : "—"} />
        <StatTile icon={SparklesIcon} label="Estimated cost" value={formatUsd(data.summary.totalCostUsd)} caption={data.summary.truncated ? "sampled" : undefined} />
        <StatTile
          icon={SparklesIcon}
          label="Tokens / avg latency"
          value={data.summary.totalTokens.toLocaleString()}
          caption={data.summary.avgLatencyMs !== null ? `avg ${data.summary.avgLatencyMs}ms` : undefined}
        />
      </div>

      <FeatureModelTable title="By feature" rows={data.byFeature} />
      <FeatureModelTable title="By model" rows={data.byModel} />
      <UserTable rows={data.byUser} />

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Failures</h2>
        {data.failures.length === 0 ? (
          <Card className="flex-row items-center gap-2 p-4 text-sm text-muted-foreground">
            <CheckCircle2Icon className="size-4 shrink-0 text-primary" /> No failed calls in this range.
          </Card>
        ) : (
          <Card className="divide-y p-0">
            {data.failures.map((failure) => (
              <div key={failure.id} className="flex items-start gap-3 p-4">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{failure.operation}</Badge>
                    <Badge variant="outline">{failure.model}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(failure.occurredAt)}</span>
                  </div>
                  <p className="mt-1 text-sm">{failure.errorMessage ?? "No error message recorded"}</p>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
