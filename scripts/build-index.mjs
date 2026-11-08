// Builds index.json from packs/<id>/pack.json (same format as `otpack index`).
//   node scripts/build-index.mjs           write index.json
//   node scripts/build-index.mjs --check   fail if index.json is out of date or a pack breaks the basic rules
//   node scripts/build-index.mjs --check --packs-only
//                                          only the packs (pull requests: index.json is rebuilt after merging)
// OpenTrainer validates every pack fully before installing it; this only checks what the list needs.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const check = process.argv.includes("--check");
const packsOnly = process.argv.includes("--packs-only");
const packsDir = "packs";
const slug = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const problems = [];
const packs = [];

for (const id of readdirSync(packsDir).sort()) {
  const dir = join(packsDir, id);
  if (!statSync(dir).isDirectory()) continue;
  const file = join(dir, "pack.json");
  if (!existsSync(file)) {
    problems.push(`${dir}: no pack.json`);
    continue;
  }
  const extra = readdirSync(dir).filter((f) => f !== "pack.json");
  if (extra.length) problems.push(`${dir}: only pack.json is allowed (found ${extra.join(", ")})`);
  const bytes = readFileSync(file);
  if (bytes.length > 4 * 1024 * 1024) problems.push(`${file}: bigger than 4 MB`);
  let pack;
  try {
    pack = JSON.parse(bytes.toString("utf8"));
  } catch (e) {
    problems.push(`${file}: not valid JSON (${e.message})`);
    continue;
  }
  if (!slug.test(id)) problems.push(`${dir}: folder name must be lowercase letters, digits, - or _`);
  if (pack.schema !== 1) problems.push(`${file}: schema must be 1`);
  if (pack.game?.id !== id) problems.push(`${file}: game.id is ${pack.game?.id} but the folder is ${id}`);
  if (!Array.isArray(pack.cheats) || pack.cheats.length === 0) problems.push(`${file}: no cheats`);
  const entry = {
    id,
    name: pack.game?.name,
    exe: pack.game?.exe,
    arch: pack.game?.arch ?? null,
    engine: pack.game?.engine ?? null,
    author: pack.meta?.author,
    packVersion: pack.meta?.packVersion,
    cheats: pack.cheats?.length ?? 0,
    notes: pack.meta?.notes ?? null,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length,
  };
  for (const k of ["name", "exe", "author", "packVersion"]) {
    if (typeof entry[k] !== "string" || !entry[k]) problems.push(`${file}: missing ${k}`);
  }
  packs.push(entry);
}

packs.sort((a, b) => String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()));

if (check && !packsOnly) {
  let old;
  try {
    old = JSON.parse(readFileSync("index.json", "utf8"));
  } catch {
    problems.push("index.json is missing or not valid JSON");
  }
  if (old) {
    const strip = (list) => JSON.stringify(list);
    if (old.format !== 1) problems.push("index.json: format must be 1");
    if (strip(old.packs) !== strip(packs)) {
      problems.push("index.json is out of date: run `node scripts/build-index.mjs` and commit it");
    }
  }
} else if (!check) {
  const index = { format: 1, updated: new Date().toISOString().slice(0, 10), packs };
  writeFileSync("index.json", JSON.stringify(index, null, 2) + "\n");
  console.log(`index.json: ${packs.length} pack(s)`);
}

if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
if (check) console.log(`ok: ${packs.length} pack(s)`);
