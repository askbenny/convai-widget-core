import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

export function stableVersion(value) {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value))
    throw new Error("Expected an exact stable version, such as 1.5.1");
  if (value.split(".").some((part) => !Number.isSafeInteger(Number(part))))
    throw new Error("Version component is too large");
  return value;
}
export function compareVersions(a, b) {
  const left = stableVersion(a).split(".").map(Number);
  const right = stableVersion(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
}
export function bumpVersion(version, bump) {
  const index = { major: 0, minor: 1, patch: 2 }[bump];
  if (index === undefined) throw new Error("Choose patch, minor, or major");
  const parts = stableVersion(version).split(".").map(Number);
  parts[index]++;
  for (let i = index + 1; i < 3; i++) parts[i] = 0;
  return stableVersion(parts.join("."));
}
export async function packageMetadata(name, version = "latest", fetcher = globalThis.fetch) {
  if (!["@askbenny/convai-widget-core", "@askbenny/convai-widget-embed"].includes(name))
    throw new Error("Unexpected package identity");
  if (version !== "latest") stableVersion(version);
  const response = await fetcher(
    `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`,
    {
      signal: globalThis.AbortSignal.timeout(30_000),
    }
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Registry request failed: ${response.status}`);
  const metadata = await response.json();
  if (metadata.name !== name || (version !== "latest" && metadata.version !== version))
    throw new Error("Registry package identity does not match");
  stableVersion(metadata.version);
  return metadata;
}
export function verifyIntegrity(bytes, integrity) {
  const match = typeof integrity === "string" && integrity.match(/^sha512-([A-Za-z0-9+/]+={0,2})$/);
  if (!match || createHash("sha512").update(bytes).digest("base64") !== match[1])
    throw new Error("Package integrity verification failed");
  return true;
}
export async function downloadPackage(metadata, fetcher = globalThis.fetch) {
  const url = new URL(metadata.dist?.tarball);
  if (url.origin !== "https://registry.npmjs.org" || url.username || url.password)
    throw new Error("Unexpected package archive host");
  const response = await fetcher(url, {
    signal: globalThis.AbortSignal.timeout(60_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Package download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  verifyIntegrity(bytes, metadata.dist.integrity);
  return bytes;
}
export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
export const writeJson = (path, value) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
export function output(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  console.log(`${name}=${value}`);
}
