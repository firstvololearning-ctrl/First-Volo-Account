import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../js/student-login-ui.js", import.meta.url), "utf8");

test("student sign-in recognizes only named First Volo return targets", () => {
  assert.match(source, /morphology:\s*"first-volo-morphology"/);
  assert.match(source, /primoVolo:\s*"primo-volo"/);
  assert.match(source, /storyBuilder:\s*"first-volo-story-builder"/);
  assert.match(source, /returnProductKeys\[requestedReturnTarget\]/);
});

test("student returns only when the class has access to the requested product", () => {
  assert.match(source, /requestedProductKey\s*&&\s*authorizedKeys\.has\(requestedProductKey\)/);
  assert.match(source, /window\.location\.replace\(studentProducts\[requestedProductKey\]\.href\)/);
});

test("student sign-out stays on the account hub and cannot bounce back to a product", () => {
  assert.match(source, /await auth\.signOut\(\);\s*renderSignIn\(\)/);
});
