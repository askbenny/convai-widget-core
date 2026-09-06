import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  stableVersion,
  bumpVersion,
  packageMetadata,
  compareVersions,
  readJson,
  writeJson,
  output,
} from "./release-utils.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const path = resolve(root, "package.json");
const pkg = readJson(path);
stableVersion(pkg.version);
const command = process.argv[2];
if (command === "prepare") {
  const latest = await packageMetadata(pkg.name);
  if (latest && compareVersions(latest.version, pkg.version) > 0)
    throw new Error(
      "This branch is behind the published version; update main before preparing a release"
    );
  pkg.version = bumpVersion(pkg.version, process.argv[3]);
  writeJson(path, pkg);
  const lockPath = resolve(root, "package-lock.json");
  if (existsSync(lockPath)) {
    const lock = readJson(lockPath);
    lock.version = pkg.version;
    if (lock.packages?.[""]) lock.packages[""].version = pkg.version;
    writeJson(lockPath, lock);
  }
  output("version", pkg.version);
} else if (command === "status") {
  const published = await packageMetadata(pkg.name, pkg.version);
  const core = pkg.devDependencies?.["@askbenny/convai-widget-core"];
  // The PR bootstrap snapshot is testable, but must be replaced by the npm
  // dependency through Sync core before an embed version can be released.
  const ready = !core || !core.startsWith("file:");
  if (core && ready) stableVersion(core);
  const commit = published?.gitHead || process.env.GITHUB_SHA;
  if (ready && (!commit || !/^[0-9a-f]{40}$/.test(commit)))
    throw new Error("The release source commit is missing or invalid");
  output("version", pkg.version);
  output("ready", ready);
  output("publish", ready && !published);
  output("commit", commit || "");
  if (!ready)
    console.log("Bootstrap snapshot: merge the Sync core dependency PR before publishing embed.");
  if (published) console.log("Version already published; it will not be republished or bumped.");
} else {
  throw new Error("Usage: node scripts/release.mjs prepare patch|minor|major, or status");
}
