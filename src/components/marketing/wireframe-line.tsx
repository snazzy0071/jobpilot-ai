import { cn } from "@/lib/utils";

export function Line({ width = "full" }: { width?: "full" | "3/4" | "1/2" | "1/3" }) {
  return (
    <div
      className={cn(
        "h-2 rounded-full bg-muted",
        width === "full" && "w-full",
        width === "3/4" && "w-3/4",
        width === "1/2" && "w-1/2",
        width === "1/3" && "w-1/3",
      )}
    />
  );
}
