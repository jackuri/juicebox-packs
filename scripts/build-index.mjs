// Builds index.json from packs/<id>/pack.json, tables/<id>.json (links to Cheat Engine tables
// on their makers' pages; JuiceBox Trainer 1.16.0+ shows them; older versions ignore them; a table
// whose maker gave it an open licence or permission may be here too, as tables/<id>.CT, 1.27.0+) and
// web/<id>.json (cheats for web games; JuiceBox Trainer 1.19.0+).
//   node scripts/build-index.mjs           write index.json
//   node scripts/build-index.mjs --check   fail if index.json is out of date or a pack breaks the basic rules
//   node scripts/build-index.mjs --check --packs-only
//                                          only the packs (pull requests: index.json is rebuilt after merging)
// JuiceBox Trainer validates every pack fully before installing it; this only checks what the list needs.
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
  // Credit (JuiceBox Trainer 1.17+ shows it): who made the cheats, their terms and support page.
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
// Same rules as JuiceBox Trainer's `community::table_problem` (the app checks them again).
const TABLE_SITES = [
  "fearlessrevolution.com",
  "www.fearlessrevolution.com",
  "forum.cheatengine.org",
  "opencheattables.com",
  "www.opencheattables.com",
  "github.com",
];
const TABLE_FIELDS = new Set(["id", "game", "exe", "title", "by", "url", "cheats", "added", "licence", "file", "sha256"]);
// Terms under which the table itself may be here (as JuiceBox Trainer's `community::HOSTING_LICENCES`).
const HOSTING_LICENCES = [
  "CC-BY-4.0",
  "CC0-1.0",
  "CC-BY-SA-4.0",
  "MIT",
  "Apache-2.0",
  "GPL-3.0-or-later",
  "Shared with permission; all rights kept by the maker",
];
const MAX_TABLE_FILE = 2 << 20;
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
  const names = readdirSync(tablesDir).sort();
  for (const name of names) {
    const file = join(tablesDir, name);
    if (name.endsWith(".CT")) {
      // A table file needs its link, which names it (checked below).
      if (!names.includes(name.replace(/\.CT$/, ".json"))) problems.push(`${file}: has no tables/<id>.json link`);
      continue;
    }
    const id = name.replace(/\.json$/, "");
    if (!name.endsWith(".json") || !slug.test(id)) {
      problems.push(`${file}: must be tables/<lowercase-id>.json (or the table itself, tables/<id>.CT)`);
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
    if (t.licence != null && !oneLine(t.licence, 100)) problems.push(`${file}: licence must be a short single line`);
    if (t.file != null || t.sha256 != null || existsSync(join(tablesDir, `${id}.CT`))) {
      const ct = join(tablesDir, `${id}.CT`);
      if (t.file !== `tables/${id}.CT`) problems.push(`${file}: file must be tables/${id}.CT`);
      if (!HOSTING_LICENCES.includes(t.licence)) {
        problems.push(`${file}: the table itself may only be here under one of: ${HOSTING_LICENCES.join(", ")}`);
      }
      if (!existsSync(ct)) {
        problems.push(`${file}: ${ct} is missing`);
      } else {
        const bytes = readFileSync(ct);
        if (bytes.length > MAX_TABLE_FILE) problems.push(`${ct}: bigger than 2 MB`);
        if (!bytes.toString("utf8").includes("<CheatTable")) problems.push(`${ct}: not a Cheat Engine table`);
        if (createHash("sha256").update(bytes).digest("hex") !== t.sha256) problems.push(`${file}: sha256 doesn't match ${ct}`);
      }
    }
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
      ...(t.licence != null ? { licence: t.licence } : {}),
      ...(t.file != null ? { file: t.file, sha256: t.sha256 } : {}),
    });
  }
}
tables.sort(
  (a, b) =>
    String(a.game).toLowerCase().localeCompare(String(b.game).toLowerCase()) || String(a.title).localeCompare(String(b.title)),
);

// ----- web cheats --------------------------------------------------------------
// web/<id>.json: cheats for a game that runs in a web page (JuiceBox Trainer 1.19.0+ shows them; older
// versions ignore them). Same rules as JuiceBox Trainer's `web::check_pack` for the list (the app checks
// them again). They're small, so the index carries them whole.
const WEB_FIELDS = new Set(["format", "id", "game", "url", "by", "notes", "added", "cheats"]);
const CHEAT_FIELDS = new Set(["name", "target", "value", "key", "keyDoes", "keep"]);
// JuiceBox Trainer 1.31.0+: a lock that keeps the number at its value, never above it, or never below it.
const KEEPS = ["at", "atMost", "atLeast"];
// JuiceBox Trainer 1.31.0+: a group of places ("every" bytes apart, "count" of them; both or neither).
const MAX_GROUP = 1024;
const NUM_TYPES = ["u8", "i16", "i32", "f32", "f64"];
const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);
function webHost(url) {
  if (typeof url !== "string" || url.length > 1000 || /[\s"<>]/.test(url) || CONTROL.test(url)) return null;
  const m = /^https:\/\/([^/?#]+)/.exec(url);
  if (!m || m[1].includes("@")) return null;
  const host = m[1].toLowerCase().replace(/:\d+$/, "");
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(host) || LOCAL.has(host)) return null;
  return host;
}
function cheatProblem(c) {
  if (!c || typeof c !== "object" || Array.isArray(c)) return "not an object";
  const extra = Object.keys(c).filter((k) => !CHEAT_FIELDS.has(k));
  if (extra.length) return `unknown fields ${extra.join(", ")}`;
  if (!oneLine(c.name, 80)) return "name must be a short single line";
  const t = c.target;
  const whole = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
  if (t?.k === "m") {
    const keys = Object.keys(t).filter((k) => !["k", "mem", "label", "size", "off", "t", "every", "count"].includes(k));
    const label = typeof t.label === "string" && [...t.label].length <= 200 && !CONTROL.test(t.label);
    if (keys.length || !whole(t.mem, 2 ** 32) || !label || !whole(t.size, Number.MAX_SAFE_INTEGER) || !whole(t.off, 2 ** 40) || !NUM_TYPES.includes(t.t)) {
      return "bad memory place";
    }
    if (t.every != null || t.count != null) {
      const ok =
        Number.isInteger(t.every) && t.every >= 1 && t.every <= 2 ** 20 &&
        Number.isInteger(t.count) && t.count >= 2 && t.count <= MAX_GROUP &&
        t.off + t.every * t.count <= 2 ** 40;
      if (!ok) return `a group needs "every" (1 to 1048576 bytes) and "count" (2 to ${MAX_GROUP} places)`;
    }
  } else if (t?.k === "j") {
    const keys = Object.keys(t).filter((k) => k !== "k" && k !== "path");
    const path = Array.isArray(t.path) && t.path.length > 0 && t.path.length <= 16;
    if (keys.length || !path || t.path.some((p) => typeof p !== "string" || p === "" || [...p].length > 120 || CONTROL.test(p))) {
      return "bad JavaScript path";
    }
    // "*" stands for every item of a list (at most two, never first or last).
    const stars = t.path.filter((p) => p === "*").length;
    if (stars > 2 || t.path[0] === "*" || t.path.at(-1) === "*") return "bad JavaScript path";
  } else return "target must be a memory place (k: m) or a JavaScript path (k: j)";
  if (c.value != null && !(typeof c.value === "number" && Number.isFinite(c.value))) return "value must be a number";
  if (c.key != null && !(oneLine(c.key, 40) && /^[A-Za-z0-9+*\-./]+$/.test(c.key))) return "bad key";
  if (c.keyDoes != null && !["lock", "set"].includes(c.keyDoes)) return "keyDoes must be lock or set";
  if (c.keyDoes === "set" && c.value == null) return "a key that sets a value needs the value";
  if (c.keep != null && !KEEPS.includes(c.keep)) return `keep must be ${KEEPS.join(", ")}`;
  return null;
}
const web = [];
const webDir = "web";
if (existsSync(webDir)) {
  for (const name of readdirSync(webDir).sort()) {
    const file = join(webDir, name);
    const id = name.replace(/\.json$/, "");
    if (!name.endsWith(".json") || !slug.test(id)) {
      problems.push(`${file}: must be web/<lowercase-id>.json`);
      continue;
    }
    const bytes = readFileSync(file);
    if (bytes.length > 64 * 1024) problems.push(`${file}: bigger than 64 KB`);
    let w;
    try {
      w = JSON.parse(bytes.toString("utf8"));
    } catch (e) {
      problems.push(`${file}: not valid JSON (${e.message})`);
      continue;
    }
    const extra = Object.keys(w).filter((k) => !WEB_FIELDS.has(k));
    if (extra.length) problems.push(`${file}: unknown fields ${extra.join(", ")}`);
    if (w.format !== 1) problems.push(`${file}: format must be 1`);
    if (w.id !== id) problems.push(`${file}: id is ${w.id} but the file is ${id}.json`);
    if (!oneLine(w.game, 120) || !oneLine(w.by, 100)) problems.push(`${file}: game and by must be short single lines`);
    if (w.notes != null && !oneLine(w.notes, 500)) problems.push(`${file}: notes must be one line (up to 500 characters)`);
    if (w.added != null && !/^\d{4}-\d{2}-\d{2}$/.test(w.added)) problems.push(`${file}: added must be YYYY-MM-DD`);
    if (!webHost(w.url)) problems.push(`${file}: url must be the game's https page (not on your own PC)`);
    if (!Array.isArray(w.cheats) || w.cheats.length === 0 || w.cheats.length > 50) {
      problems.push(`${file}: needs 1 to 50 cheats`);
    } else {
      w.cheats.forEach((c, i) => {
        const why = cheatProblem(c);
        if (why) problems.push(`${file}: cheat ${i + 1}: ${why}`);
      });
    }
    const entry = { format: 1, id, game: w.game, url: w.url, by: w.by };
    if (w.notes != null) entry.notes = w.notes;
    if (w.added != null) entry.added = w.added;
    entry.cheats = Array.isArray(w.cheats) ? w.cheats : [];
    web.push(entry);
  }
}
web.sort((a, b) => String(a.game).toLowerCase().localeCompare(String(b.game).toLowerCase()) || a.id.localeCompare(b.id));

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
    if (strip(old.packs) !== strip(packs) || strip(old.tables ?? []) !== strip(tables) || strip(old.web ?? []) !== strip(web)) {
      problems.push("index.json is out of date: run `node scripts/build-index.mjs` and commit it");
    }
  }
} else if (!check) {
  const index = { format: 1, updated: new Date().toISOString().slice(0, 10), packs, tables, web };
  writeFileSync("index.json", JSON.stringify(index, null, 2) + "\n");
  console.log(`index.json: ${packs.length} pack(s), ${tables.length} table link(s), ${web.length} web game(s)`);
}

if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
if (check) console.log(`ok: ${packs.length} pack(s), ${tables.length} table link(s), ${web.length} web game(s)`);
