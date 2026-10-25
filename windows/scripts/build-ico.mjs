import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tempDir = join(root, "temp_icons");
const outIco = join(root, "src-tauri", "icons", "icon.ico");

function encodeICO(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;
  entries.forEach((e, i) => {
    const o = i * 16;
    dir[o] = e.size >= 256 ? 0 : e.size;
    dir[o + 1] = e.size >= 256 ? 0 : e.size;
    dir[o + 2] = 0;
    dir[o + 3] = 0;
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(e.png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += e.png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

const sizes = [16, 24, 32, 48, 64, 128, 256];
const entries = sizes.map((size) => ({
  size,
  png: readFileSync(join(tempDir, `${size}.png`)),
}));

const icoBuffer = encodeICO(entries);
writeFileSync(outIco, icoBuffer);
console.log(`Successfully generated ${outIco} (${icoBuffer.length} bytes)`);

// Clean up temp_icons
rmSync(tempDir, { recursive: true, force: true });
console.log("Cleaned up temp_icons directory.");
