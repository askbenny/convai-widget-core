import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  stableVersion,
  bumpVersion,
  compareVersions,
  packageMetadata,
  verifyIntegrity,
} from "../release-utils.mjs";

test("release versions must be stable exact semver", () => {
  for (const version of ["latest", "^1.2.3", "1.2.3-beta.1", "1.02.3", "1.2.3;echo nope"])
    assert.throws(() => stableVersion(version));
  assert.equal(stableVersion("1.2.3"), "1.2.3");
});
test("bumps the version exactly once and compares numerically", () => {
  assert.equal(bumpVersion("1.9.9", "patch"), "1.9.10");
  assert.equal(bumpVersion("1.9.9", "minor"), "1.10.0");
  assert.equal(bumpVersion("1.9.9", "major"), "2.0.0");
  assert.throws(() => bumpVersion("1.0.0", "anything"));
  assert.ok(compareVersions("1.10.0", "1.9.9") > 0);
});
test("only a registry 404 means unpublished; outages fail closed", async () => {
  assert.equal(
    await packageMetadata(
      "@askbenny/convai-widget-core",
      "1.5.0",
      async () => new Response("", { status: 404 })
    ),
    null
  );
  await assert.rejects(
    packageMetadata(
      "@askbenny/convai-widget-core",
      "1.5.0",
      async () => new Response("", { status: 503 })
    ),
    /503/
  );
});
test("registry identity must match the requested package and version", async () => {
  await assert.rejects(
    packageMetadata("@askbenny/convai-widget-core", "1.5.0", async () =>
      Response.json({ name: "other", version: "1.5.0" })
    ),
    /identity/
  );
});
test("downloaded packages must match registry integrity", () => {
  const bytes = Buffer.from("trusted package");
  const integrity = "sha512-" + createHash("sha512").update(bytes).digest("base64");
  assert.equal(verifyIntegrity(bytes, integrity), true);
  assert.throws(() => verifyIntegrity(Buffer.from("tampered"), integrity), /integrity/);
  assert.throws(() => verifyIntegrity(bytes, "sha1-untrusted"), /integrity/);
});
