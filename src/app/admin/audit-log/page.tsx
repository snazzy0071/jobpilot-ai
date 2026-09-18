import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listAdminAuditLogs, listAuditEntityTypes } from "@/lib/admin/audit/queries";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; search?: string }>;
}) {
  const params = await searchParams;
  const [entries, entityTypes] = await Promise.all([
    listAdminAuditLogs({ entityType: params.entityType || undefined, search: params.search || undefined }),
    listAuditEntityTypes(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-muted-foreground">Every privileged admin action, append-only — most recent {entries.length.toLocaleString()} shown.</p>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <label htmlFor="search" className="text-sm font-medium">
            Search
          </label>
          <Input id="search" name="search" defaultValue={params.search ?? ""} placeholder="Action, actor email, or entity id" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="entityType" className="text-sm font-medium">
            Entity type
          </label>
          <select
            id="entityType"
            name="entityType"
            defaultValue={params.entityType ?? ""}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Any type</option>
            {entityTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Filter</Button>
        {(params.search || params.entityType) && <Button type="button" variant="ghost" render={<Link href="/admin/audit-log">Clear</Link>} />}
      </form>

      {entries.length === 0 ? (
        <Card className="items-center gap-2 p-10 text-center text-sm text-muted-foreground">No audit entries match these filters.</Card>
      ) : (
        <Card className="divide-y p-0">
          {entries.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-1 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{entry.action}</Badge>
                  <Badge variant="outline">{entry.entityType}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
              </div>
              <p className="text-sm">
                {entry.actorEmail ?? "Unknown actor"}
                {entry.entityId ? ` → ${entry.entityId}` : ""}
              </p>
              {Object.keys(entry.metadata).length > 0 && (
                <p className="font-mono text-xs text-muted-foreground break-all">{JSON.stringify(entry.metadata)}</p>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
