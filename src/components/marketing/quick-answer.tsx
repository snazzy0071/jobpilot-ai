export function QuickAnswer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border-l-4 border-primary bg-muted/40 p-4 text-sm">
      <span className="font-semibold">Quick answer: </span>
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}
