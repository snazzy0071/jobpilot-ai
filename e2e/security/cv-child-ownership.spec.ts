import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { seedCv } from "../support/cv";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";

// A signed-in user must not be able to attach rows to someone else's CV, even holding that CV's version id (migration 0125).

test.describe.configure({ mode: "serial" });
const db = () => getAdminClient();
let alice: IsolatedUser;
let bob: IsolatedUser;
let bobVersionId = "";
let bobCvId = "";

test.beforeAll(async () => {
  alice = await createIsolatedUser({ fullName: "Alice Owner" });
  bob = await createIsolatedUser({ fullName: "Bob Victim" });
  const seeded = await seedCv(bob.id, { title: "Bob CV" });
  bobCvId = seeded.cvId;
  bobVersionId = seeded.versionId;
});
test.afterAll(async () => {
  await deleteIsolatedUser(alice.id);
  await deleteIsolatedUser(bob.id);
});

async function asAlice() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: alice.email, password: alice.password });
  if (error) throw new Error(error.message);
  return client;
}

test("attaching a section row to another user's CV version is refused, whoever the row claims to belong to", async () => {
  const client = await asAlice();
  const attempts = [
    client.from("cv_summary").insert({ cv_version_id: bobVersionId, user_id: alice.id, content: "planted by alice" }),
    client.from("cv_skills").insert({ cv_version_id: bobVersionId, user_id: alice.id, name: "planted" }),
  ];
  for (const attempt of attempts) expect((await attempt).error?.message).toMatch(/does not belong to this user/);
  const { data } = await db().from("cv_summary").select("content").eq("cv_version_id", bobVersionId);
  expect((data ?? []).some((row) => row.content === "planted by alice")).toBe(false);
});

test("a CV version cannot be created under someone else's CV", async () => {
  const client = await asAlice();
  const { error } = await client.from("cv_versions").insert({ cv_id: bobCvId, user_id: alice.id });
  expect(error?.message).toMatch(/does not belong to this user/);
  expect((await db().from("cv_versions").select("id").eq("cv_id", bobCvId)).data).toHaveLength(1);
});

test("a user's own CV rows still save normally", async () => {
  const own = await seedCv(alice.id, { title: "Alice CV" });
  const client = await asAlice();
  const { error } = await client.from("cv_summary").update({ content: "edited by alice" }).eq("cv_version_id", own.versionId);
  expect(error).toBeNull();
  expect((await db().from("cv_summary").select("content").eq("cv_version_id", own.versionId).single()).data?.content).toBe("edited by alice");
});
