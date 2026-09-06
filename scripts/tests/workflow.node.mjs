import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
test("publishing uses tested code and never mutates its version", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/npm-publish.yml", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(workflow, /npm version patch/);
  assert.match(workflow, /needs: validate/);
  assert.match(workflow, /release\.mjs status/);
});
test("package metadata agrees across the checked-in manifests", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(
    readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8")
  );
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
});
test("published core pins the external runtimes used by its tests", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  for (const name of ["preact", "@preact/signals", "@elevenlabs/client"])
    assert.match(pkg.dependencies[name], /^\d+\.\d+\.\d+$/);
});
