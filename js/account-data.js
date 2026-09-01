(function () {
  "use strict";

  const definitions = Object.freeze([
    { key: "first-volo-story-builder", label: "Story Builder" },
    { key: "first-volo-morphology", label: "Morphology" },
    { key: "primo-volo", label: "Primo Volo" }
  ]);

  async function getAccountSnapshot() {
    const auth = window.FirstVoloAccountAuth;
    const user = await auth.ready();
    const client = window.FirstVoloAccountSupabase?.client;
    if (!client) return { user: null, educatorProfile: null, entitlements: [], classes: [], students: [], classProductAccess: [], error: new Error("Auth unavailable") };
    if (!user) return { user: null, educatorProfile: null, entitlements: [], classes: [], students: [], classProductAccess: [], error: null };
    if (user.is_anonymous) return { user, anonymous: true, educatorProfile: null, entitlements: [], classes: [], students: [], classProductAccess: [], error: null };
    const [profile, entitlements, classes, students, memberships, classProductAccess] = await Promise.all([
      client.from("educator_profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
      client.from("product_entitlements").select("product_key,access_type,status,starts_at,expires_at").eq("owner_user_id", user.id).in("product_key", definitions.map(item => item.key)).eq("status", "active"),
      client.from("classes").select("id,name,class_code").is("archived_at", null).order("name"),
      client.from("students").select("id,display_name,student_code_hint").is("archived_at", null).order("display_name"),
      client.from("class_memberships").select("class_id,student_id"),
      client.from("class_product_access").select("class_id,product_key")
    ]);
    const queryError = profile.error || entitlements.error || classes.error || students.error || memberships.error || classProductAccess.error;
    if (queryError) {
      await auth.handleSessionError(queryError);
      return { user, educatorProfile: profile.data || null, entitlements: [], classes: [], students: [], classProductAccess: [], error: queryError };
    }
    const now = Date.now();
    const classById = new Map(classes.data.map(item => [item.id, item]));
    const classIdByStudentId = new Map(memberships.data.map(item => [item.student_id, item.class_id]));
    const studentRows = students.data.map(student => {
      const classId = classIdByStudentId.get(student.id) || null;
      return { ...student, class_id: classId, class_name: classById.get(classId)?.name || "Unassigned", class_code: classById.get(classId)?.class_code || "" };
    });
    return { user, educatorProfile: profile.data || null, entitlements: entitlements.data.filter(row => Date.parse(row.starts_at) <= now && Date.parse(row.expires_at) > now), classes: classes.data, students: studentRows, classProductAccess: classProductAccess.data, error: null };
  }

  window.FirstVoloAccountData = { definitions, getAccountSnapshot };
}());
