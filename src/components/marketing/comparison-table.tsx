import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComparisonColumn = {
  id: string;
  label: string;
  highlighted?: boolean;
};

export type ComparisonRow = {
  label: string;
  values: Record<string, boolean | string>;
};

function ComparisonCell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto size-4 text-primary" aria-label="Yes" />
    ) : (
      <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="No" />
    );
  }
  return <span className="text-sm">{value}</span>;
}

export function ComparisonTable({
  columns,
  rows,
}: {
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b">
            <th scope="col" className="p-4 font-medium text-muted-foreground">
              &nbsp;
            </th>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  "p-4 text-center font-semibold",
                  column.highlighted && "bg-primary/5 text-primary",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b last:border-0">
              <th scope="row" className="p-4 font-normal text-foreground">
                {row.label}
              </th>
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    "p-4 text-center",
                    column.highlighted && "bg-primary/5",
                  )}
                >
                  <ComparisonCell value={row.values[column.id] ?? false} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
