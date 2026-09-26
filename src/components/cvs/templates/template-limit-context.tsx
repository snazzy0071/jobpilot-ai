"use client";

import { createContext, useContext, type ReactNode } from "react";

// The plan's template allowance (cv_template_count) for the signed-in user, handed to the template pickers so they can mark templates
// their plan doesn't include. Display only: createCv and updateCvTemplate enforce it on the server. null means every template.
const TemplateLimitContext = createContext<number | null>(null);

export function TemplateLimitProvider({ limit, children }: { limit: number | null; children: ReactNode }) {
  return <TemplateLimitContext.Provider value={limit}>{children}</TemplateLimitContext.Provider>;
}

export function useTemplateLimit(): number | null {
  return useContext(TemplateLimitContext);
}
