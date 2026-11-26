// Plain-English labels for admin audit-log entries. The stored `action`
// stays a stable machine code ("user.delete"); this is only how it reads
// on screen. An action missing here still gets a readable fallback.

const ACTION_LABELS: Record<string, string> = {
  "access_code.create": "Created an access code",
  "access_code.deactivate": "Deactivated an access code",
  "access_code.reactivate": "Reactivated an access code",
  "admin_role.create": "Created an admin role",
  "admin_role.delete": "Deleted an admin role",
  "admin_role.update": "Updated an admin role",
  "admin_user_role.grant": "Gave a staff member an admin role",
  "admin_user_role.revoke": "Removed an admin role from a staff member",
  "advice_guide.create": "Created an advice guide",
  "advice_guide.delete": "Deleted an advice guide",
  "advice_guide.feature": "Featured an advice guide",
  "advice_guide.publish": "Published an advice guide",
  "advice_guide.unfeature": "Unfeatured an advice guide",
  "advice_guide.unpublish": "Unpublished an advice guide",
  "advice_guide.update": "Updated an advice guide",
  "app_settings.update": "Changed site settings",
  "blog_author.create": "Added a blog author",
  "blog_category.create": "Added a blog category",
  "blog_post.create": "Created a blog post",
  "blog_post.delete": "Deleted a blog post",
  "blog_post.update": "Updated a blog post",
  "comparison_page.create": "Created a comparison page",
  "comparison_page.delete": "Deleted a comparison page",
  "comparison_page.publish": "Published a comparison page",
  "comparison_page.unpublish": "Unpublished a comparison page",
  "comparison_page.update": "Updated a comparison page",
  "graduate_scheme.assessment_add": "Added a graduate scheme assessment",
  "graduate_scheme.assessment_delete": "Deleted a graduate scheme assessment",
  "graduate_scheme.assessment_import": "Imported graduate scheme assessments",
  "graduate_scheme.assessment_update": "Updated a graduate scheme assessment",
  "graduate_scheme.create": "Created a graduate scheme",
  "graduate_scheme.dates_update": "Updated graduate scheme dates",
  "graduate_scheme.delete": "Deleted a graduate scheme",
  "graduate_scheme.import": "Imported graduate schemes",
  "graduate_scheme.publish": "Published a graduate scheme",
  "graduate_scheme.unpublish": "Unpublished a graduate scheme",
  "graduate_scheme.update": "Updated a graduate scheme",
  "graduate_scheme.verify": "Verified a graduate scheme",
  "institution.create": "Created an institution",
  "institution_domain.unverify": "Unverified an institution domain",
  "institution_domain.verify": "Verified an institution domain",
  "institution_licence.create": "Created an institution licence",
  "institution_licence.deactivate": "Deactivated an institution licence",
  "institution_licence.update": "Updated an institution licence",
  "institution_member.add_admin": "Added an institution admin",
  "lead.delete": "Deleted a lead",
  "sponsor_sync.trigger": "Started a sponsor register sync",
  "subscription.cancel": "Cancelled a subscription",
  "test_prep.pack_create": "Created a test prep pack",
  "test_prep.pack_delete": "Deleted a test prep pack",
  "test_prep.pack_update": "Updated a test prep pack",
  "test_prep.question_activate": "Activated a test prep question",
  "test_prep.question_create": "Created a test prep question",
  "test_prep.question_deactivate": "Deactivated a test prep question",
  "test_prep.question_delete": "Deleted a test prep question",
  "test_prep.question_duplicate": "Duplicated a test prep question",
  "test_prep.question_update": "Updated a test prep question",
  "test_prep.questions_import": "Imported test prep questions",
  "test_prep.type_create": "Created a test prep type",
  "test_prep.type_delete": "Deleted a test prep type",
  "test_prep.type_update": "Updated a test prep type",
  "user.delete": "Deleted a user",
  "user.impersonate_end": "Stopped viewing as a user",
  "user.impersonate_start": "Started viewing as a user",
};

const ENTITY_LABELS: Record<string, string> = {
  access_code: "Access codes",
  admin_role: "Admin roles",
  admin_user_role: "Staff access",
  advice_guide: "Advice guides",
  app_settings: "Settings",
  blog_post: "Blog",
  comparison_page: "Comparison pages",
  graduate_scheme: "Graduate schemes",
  institution: "Institutions",
  institution_licence: "Institution licences",
  institution_member: "Institution members",
  lead: "Leads",
  sponsor_sync: "Sponsor register",
  subscription: "Subscriptions",
  test_prep: "Test prep",
  user: "Users",
};

function humanize(code: string): string {
  const words = code.replace(/[._]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : code;
}

export function describeAdminAction(action: string): string {
  return ACTION_LABELS[action] ?? humanize(action);
}

export function describeAdminEntity(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? humanize(entityType);
}
