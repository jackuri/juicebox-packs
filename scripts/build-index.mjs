// Builds index.json from packs/<id>/pack.json and tables/<id>.json (links to Cheat Engine tables
// on their makers' pages; OpenTrainer 1.16.0+ shows them; older versions ignore them).
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
  // Credit (OpenTrainer 1.17+ shows it): who made the cheats, their terms and support page.
  const src = pack.meta?.source;
  if (src && typeof src === "object") {
    const source = {};
    for (const k of ["by", "url", "licence", "support"]) if (typeof src[k] === "string") source[k] = src[k];
    if (src.fromMaker === true) source.fromMaker = true;
    if (Object.keys(source).length) entry.source = source;
  }
  for (const k of ["name", "exe", "author", "packVersion"]) {
    if (typeof entry[k] !== "string" || !entry[k]) problems.push(`${file}: missing ${k}`);
  }
  packs.push(entry);
}

packs.sort((a, b) => String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()));

// ----- table links -----------------------------------------------------------
// Same rules as OpenTrainer's `community::table_problem` (the app checks them again).
const TABLE_SITES = [
  "fearlessrevolution.com",
  "www.fearlessrevolution.com",
  "forum.cheatengine.org",
  "opencheattables.com",
  "www.opencheattables.com",
  "github.com",
];
const TABLE_FIELDS = new Set(["id", "game", "exe", "title", "by", "url", "cheats", "added"]);
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
const oneLine = (s, max) => typeof s === "string" && s.trim() !== "" && [...s].length <= max && !CONTROL.test(s);
function tableSite(url) {
  if (typeof url !== "string" || url.length > 400 || /[\s"<>]/.test(url) || CONTROL.test(url)) return null;
  const m = /^https:\/\/([^/?#]+)/.exec(url);
  if (!m) return null;
  const host = m[1].toLowerCase();
  return TABLE_SITES.includes(host) ? host : null;
}
const tables = [];
const tablesDir = "tables";
const seenUrls = new Set();
if (existsSync(tablesDir)) {
  for (const name of readdirSync(tablesDir).sort()) {
    const file = join(tablesDir, name);
    const id = name.replace(/\.json$/, "");
    if (!name.endsWith(".json") || !slug.test(id)) {
      problems.push(`${file}: must be tables/<lowercase-id>.json`);
      continue;
    }
    const bytes = readFileSync(file);
    if (bytes.length > 4096) problems.push(`${file}: bigger than 4 KB`);
    let t;
    try {
      t = JSON.parse(bytes.toString("utf8"));
    } catch (e) {
      problems.push(`${file}: not valid JSON (${e.message})`);
      continue;
    }
    const extra = Object.keys(t).filter((k) => !TABLE_FIELDS.has(k));
    if (extra.length) problems.push(`${file}: unknown fields ${extra.join(", ")}`);
    if (t.id !== id) problems.push(`${file}: id is ${t.id} but the file is ${id}.json`);
    if (!tableSite(t.url)) {
      problems.push(`${file}: url must be an https page on ${TABLE_SITES.filter((s) => !s.startsWith("www.")).join(", ")}`);
    }
    if (!oneLine(t.game, 120) || !oneLine(t.title, 160) || !oneLine(t.by, 100)) {
      problems.push(`${file}: game, title and by must be short single lines`);
    }
    if (t.exe != null && (!oneLine(t.exe, 120) || /[/\\:]/.test(t.exe))) problems.push(`${file}: exe must be a file name`);
    if (t.cheats != null && !(Number.isInteger(t.cheats) && t.cheats >= 0)) problems.push(`${file}: cheats must be a whole number`);
    if (t.added != null && !/^\d{4}-\d{2}-\d{2}$/.test(t.added)) problems.push(`${file}: added must be YYYY-MM-DD`);
    if (seenUrls.has(t.url)) problems.push(`${file}: this page is already listed`);
    seenUrls.add(t.url);
    tables.push({
      id,
      game: t.game,
      exe: t.exe ?? null,
      title: t.title,
      by: t.by,
      url: t.url,
      cheats: t.cheats ?? null,
      added: t.added ?? null,
    });
  }
}
tables.sort(
  (a, b) =>
    String(a.game).toLowerCase().localeCompare(String(b.game).toLowerCase()) || String(a.title).localeCompare(String(b.title)),
);

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
    if (strip(old.packs) !== strip(packs) || strip(old.tables ?? []) !== strip(tables)) {
      problems.push("index.json is out of date: run `node scripts/build-index.mjs` and commit it");
    }
  }
} else if (!check) {
  const index = { format: 1, updated: new Date().toISOString().slice(0, 10), packs, tables };
  writeFileSync("index.json", JSON.stringify(index, null, 2) + "\n");
  console.log(`index.json: ${packs.length} pack(s), ${tables.length} table link(s)`);
}

if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
if (check) console.log(`ok: ${packs.length} pack(s), ${tables.length} table link(s)`);
