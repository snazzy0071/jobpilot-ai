import { getAdminClient } from "./admin-client";

export type SeededCv = { cvId: string; versionId: string };

/**
 * Creates a CV (with a current version and a realistic amount of content)
 * directly through the service role, for tests about editing, template
 * switching and export rather than about the "create CV" dialog itself.
 *
 * The default template is a *legacy* slug on purpose: it is valid in the
 * `cv_template` enum whether or not migrations 0088/0089 have been
 * applied to the database under test, and `normalizeCvTemplate` maps it to
 * the same catalog template everywhere (single-navy → cambridge).
 */
export async function seedCv(userId: string, options: { title?: string; template?: string; fullName?: string } = {}): Promise<SeededCv> {
  const db = getAdminClient();
  const fullName = options.fullName ?? "Ada Persist";

  const { data: cv, error: cvError } = await db
    .from("cvs")
    .insert({ user_id: userId, title: options.title ?? "Audit CV", template: options.template ?? "single-navy" })
    .select("id")
    .single();
  if (cvError || !cv) throw new Error(`e2e/support/cv.ts: couldn't create a CV: ${cvError?.message}`);

  const { data: version, error: versionError } = await db.from("cv_versions").insert({ cv_id: cv.id, user_id: userId }).select("id").single();
  if (versionError || !version) throw new Error(`e2e/support/cv.ts: couldn't create a CV version: ${versionError?.message}`);

  const rows = [
    db.from("cv_personal").insert({
      cv_version_id: version.id,
      user_id: userId,
      full_name: fullName,
      headline: "Senior Platform Engineer",
      email: "ada.persist@example.com",
      phone: "07700 900456",
      location: "Leeds, UK",
    }),
    db.from("cv_summary").insert({
      cv_version_id: version.id,
      user_id: userId,
      content: "Engineer with eight years' experience building reliable platforms for growing UK companies.",
    }),
    db.from("cv_experience").insert([
      {
        cv_version_id: version.id,
        user_id: userId,
        job_title: "Senior Platform Engineer",
        employer: "Marlow Tech",
        location: "Leeds",
        start_date: "2021-03-01",
        is_current: true,
        description: "- Cut deployment time by 60 percent\n- Led a team of four engineers",
        display_order: 0,
      },
      {
        cv_version_id: version.id,
        user_id: userId,
        job_title: "Software Engineer",
        employer: "Northbridge Partners",
        location: "Manchester",
        start_date: "2017-06-01",
        end_date: "2021-02-01",
        is_current: false,
        description: "Built internal tooling used by two hundred colleagues.",
        display_order: 1,
      },
    ]),
    db.from("cv_education").insert({
      cv_version_id: version.id,
      user_id: userId,
      institution: "Northbridge University",
      qualification: "BSc Computer Science",
      start_date: "2013-09-01",
      end_date: "2017-06-30",
      grade: "First",
      display_order: 0,
    }),
    db.from("cv_skills").insert([
      { cv_version_id: version.id, user_id: userId, name: "TypeScript", category: "Languages", display_order: 0 },
      { cv_version_id: version.id, user_id: userId, name: "Kubernetes", category: "Platform", display_order: 1 },
    ]),
  ];
  for (const result of await Promise.all(rows)) {
    if (result.error) throw new Error(`e2e/support/cv.ts: couldn't seed CV content: ${result.error.message}`);
  }

  return { cvId: cv.id, versionId: version.id };
}

/** True when the database's `cv_template` enum already has the redesigned catalog (migrations 0088/0089). */
export async function databaseKnowsNewTemplates(userId: string): Promise<boolean> {
  const db = getAdminClient();
  const { data: cv } = await db.from("cvs").insert({ user_id: userId, title: "enum probe", template: "single-ink" }).select("id").single();
  if (!cv) return false;
  const { error } = await db.from("cvs").update({ template: "sovereign" }).eq("id", cv.id);
  await db.from("cvs").delete().eq("id", cv.id);
  return !error;
}
