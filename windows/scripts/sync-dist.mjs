import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releasesDir = resolve(root, "Releases");
const distDir = resolve(root, "dist");

if (existsSync(releasesDir)) {
  mkdirSync(distDir, { recursive: true });
  cpSync(releasesDir, distDir, { recursive: true });
  console.log("  Synced build from Releases/ to dist/");
}
