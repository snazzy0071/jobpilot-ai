export type AdminAuditLogEntry = {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AdminAuditLogFilters = {
  entityType?: string;
  search?: string;
};
