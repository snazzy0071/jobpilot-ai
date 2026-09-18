export type AdminEmailLogEntry = {
  id: string;
  recipient: string;
  template: string;
  status: "sent" | "failed";
  attempts: number;
  errorName: string | null;
  createdAt: string;
};

export type AdminEmailLogFilters = {
  template?: string;
  status?: "sent" | "failed";
};
