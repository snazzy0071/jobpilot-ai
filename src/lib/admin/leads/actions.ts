"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/admin/audit/log";

const idSchema = z.object({ id: z.string().uuid() });

type LeadTable = "newsletter_subscribers" | "contact_messages" | "demo_requests" | "partner_inquiries" | "campus_crew_applications";

async function deleteLeadRow(table: LeadTable, formData: FormData) {
  const { user: actingAdmin } = await requirePermission("view_leads");

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request." };

  const admin = createAdminClient();
  const { error } = await admin.from(table).delete().eq("id", parsed.data.id);
  if (error) return { error: "Couldn't delete that entry — try again." };

  // Deleting a person's submitted details is personal-data handling: record who did it, which table and which row (never the content).
  await logAdminAction({ actorId: actingAdmin.id, actorEmail: actingAdmin.email ?? null, action: "lead.delete", entityType: "lead", entityId: parsed.data.id, metadata: { table } });

  revalidatePath("/admin/leads");
}

export async function deleteNewsletterSubscriber(_prevState: unknown, formData: FormData) {
  return deleteLeadRow("newsletter_subscribers", formData);
}

export async function deleteContactMessage(_prevState: unknown, formData: FormData) {
  return deleteLeadRow("contact_messages", formData);
}

export async function deleteDemoRequest(_prevState: unknown, formData: FormData) {
  return deleteLeadRow("demo_requests", formData);
}

export async function deletePartnerInquiry(_prevState: unknown, formData: FormData) {
  return deleteLeadRow("partner_inquiries", formData);
}

export async function deleteCampusCrewApplication(_prevState: unknown, formData: FormData) {
  return deleteLeadRow("campus_crew_applications", formData);
}
