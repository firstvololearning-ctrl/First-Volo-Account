import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(new URL("../supabase/migrations/20260903140000_single_admin_entitlement_management.sql", import.meta.url), "utf8");
const adminUi = fs.readFileSync(new URL("../js/admin-ui.js", import.meta.url), "utf8");
const accountData = fs.readFileSync(new URL("../js/account-data.js", import.meta.url), "utf8");
const accountUi = fs.readFileSync(new URL("../js/account-ui.js", import.meta.url), "utf8");
const authSession = fs.readFileSync(new URL("../js/auth-session.js", import.meta.url), "utf8");
const indexHtml = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const callbackHtml = fs.readFileSync(new URL("../auth-callback.html", import.meta.url), "utf8");

assert.match(migration, /private\.admin_memberships/);
assert.match(migration, /private\.entitlement_admin_audit/);
assert.match(migration, /private\.is_entitlement_admin\(auth\.uid\(\)\)/);
assert.match(migration, /security definer\s+set search_path = ''/i);
assert.match(migration, /revoke execute on function public\.set_educator_complimentary_access[\s\S]+from public, anon/i);
assert.match(migration, /coalesce\(is_anonymous, false\) = false/);
assert.match(migration, /p_product_key not in \('first-volo-story-builder', 'first-volo-morphology', 'primo-volo'\)/);
assert.doesNotMatch(migration, /service_role/i);
assert.match(adminUi, /find_educator_entitlements/);
assert.match(adminUi, /set_educator_complimentary_access/);
assert.match(accountData, /get_entitlement_admin_status/);
assert.match(accountUi, /Manage educator subscriptions/);
assert.match(accountUi, /Create an educator account or sign in by email/);
assert.match(accountUi, /Email me a sign-in code/);
assert.match(accountUi, /Verify code and sign in/);
assert.match(accountUi, /sendEmailCode/);
assert.match(accountUi, /verifyEmailCode/);
assert.match(authSession, /client\.auth\.verifyOtp\(\{ email, token, type: "email" \}\)/);
assert.match(indexHtml, /images\/logo\.png/);
assert.match(callbackHtml, /Return to My First Volo/);
assert.match(authSession, /otp_expired/);

console.log("Account admin contract checks passed.");
