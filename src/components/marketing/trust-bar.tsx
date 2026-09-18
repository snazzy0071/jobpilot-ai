import { Fragment } from "react";

const POINTS = [
  "No credit card required",
  "UK-format CV templates",
  "Real UK Home Office sponsor data",
  "GDPR-minded, UK-hosted",
];

export function TrustBar() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
      {POINTS.map((point, index) => (
        <Fragment key={point}>
          {index > 0 && <span aria-hidden="true" className="hidden text-border sm:inline">&middot;</span>}
          <span>{point}</span>
        </Fragment>
      ))}
    </div>
  );
}
