import { db } from "@/db/client";
import { auditLogs } from "@/db/schema";
import type { RequestMeta, SessionUser } from "./auth/session";

export interface AuditInput {
  actor?: Pick<SessionUser, "id" | "email" | "fullName" | "branchId"> | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  branchId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  meta?: RequestMeta;
}

/** Append-only audit trail. Never throws into the calling action. */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorUserId: input.actor?.id ?? null,
      actorName: input.actor?.fullName ?? null,
      actorEmail: input.actor?.email ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      branchId: input.branchId ?? input.actor?.branchId ?? null,
      description: input.description ?? null,
      metadata: input.metadata ?? null,
      ipAddress: input.meta?.ipAddress ?? null,
      userAgent: input.meta?.userAgent?.slice(0, 255) ?? null,
    });
  } catch (error) {
    console.error("[audit] failed to record entry", error);
  }
}
