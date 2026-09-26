import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminNewsletterSubscriber, AdminContactMessage, AdminDemoRequest, AdminPartnerInquiry, AdminCampusCrewApplication } from "@/lib/admin/leads/types";

const LIST_LIMIT = 200;

// All four tables are insert-only for anon/authenticated (migrations
// 0011-0014's own comments: "nobody but future admin tooling can read
// submissions back") — this is that tooling, so every read here needs
// the service-role client.

export async function listNewsletterSubscribers(): Promise<AdminNewsletterSubscriber[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("newsletter_subscribers")
    .select("id, email, subscribed_at, consent_source, status, unsubscribed_at")
    .order("subscribed_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    email: row.email,
    subscribedAt: row.subscribed_at,
    consentSource: row.consent_source,
    status: row.status,
    unsubscribedAt: row.unsubscribed_at,
  }));
}

export async function listContactMessages(): Promise<AdminContactMessage[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contact_messages")
    .select("id, name, email, subject, message, created_at")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    createdAt: row.created_at,
  }));
}

export async function listDemoRequests(): Promise<AdminDemoRequest[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("demo_requests")
    .select("id, institution_name, contact_name, email, role, student_population, message, created_at")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    institutionName: row.institution_name,
    contactName: row.contact_name,
    email: row.email,
    role: row.role,
    studentPopulation: row.student_population,
    message: row.message,
    createdAt: row.created_at,
  }));
}

export async function listPartnerInquiries(): Promise<AdminPartnerInquiry[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("partner_inquiries")
    .select("id, organisation_name, contact_name, email, partnership_type, message, created_at")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    organisationName: row.organisation_name,
    contactName: row.contact_name,
    email: row.email,
    partnershipType: row.partnership_type,
    message: row.message,
    createdAt: row.created_at,
  }));
}

export async function listCampusCrewApplications(): Promise<AdminCampusCrewApplication[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("campus_crew_applications")
    .select("id, name, email, university, course, study_year, motivation, reach, created_at")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    university: row.university,
    course: row.course,
    studyYear: row.study_year,
    motivation: row.motivation,
    reach: row.reach,
    createdAt: row.created_at,
  }));
}
