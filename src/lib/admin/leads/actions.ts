"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";

const idSchema = z.object({ id: z.string().uuid() });

type LeadTable = "newsletter_subscribers" | "contact_messages" | "demo_requests" | "partner_inquiries";

async function deleteLeadRow(table: LeadTable, formData: FormData) {
  await requirePermission("view_leads");

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request." };

  const admin = createAdminClient();
  const { error } = await admin.from(table).delete().eq("id", parsed.data.id);
  if (error) return { error: "Couldn't delete that entry — try again." };

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
