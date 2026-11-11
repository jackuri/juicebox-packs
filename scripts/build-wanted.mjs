// Builds wanted.json: the games players asked cheats for (open issues labelled "request"),
// most votes first. JuiceBox Trainer 1.25.0+ shows it as "Most wanted". Issue text comes from
// anyone: only the game name and exe are taken, checked and trimmed; links are built from the
// issue number, never from what people wrote.
//
// Usage (in the workflow): GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo node scripts/build-wanted.mjs
// Tests: node scripts/build-wanted.mjs --test
import { readFileSync, writeFileSync } from "node:fs";

const repo = process.env.GITHUB_REPOSITORY ?? "jackuri/juicebox-packs";
const token = process.env.GITHUB_TOKEN;
const MAX = 200;

/** The answer under "### <label>" in an issue form's body. */
export function field(body, label) {
  const lines = String(body ?? "").split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim().toLowerCase() === `### ${label.toLowerCase()}`);
  if (at < 0) return null;
  const rest = [];
  for (const l of lines.slice(at + 1)) {
    if (l.startsWith("### ")) break;
    rest.push(l);
  }
  const text = rest.join("\n").trim();
  return text && text !== "_No response_" ? text : null;
}

/** A game name safe to show: one line, printable, 2 to 80 characters. */
export function cleanGame(s) {
  const t = String(s ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length >= 2 && t.length <= 80 ? t : null;
}

/** A plain exe file name, or null. */
export function cleanExe(s) {
  const t = String(s ?? "").trim();
  return /^[A-Za-z0-9 ._()+-]{1,80}\.exe$/i.test(t) ? t : null;
}

/** The list from GitHub's issues (open, not pull requests). */
export function wantedFrom(issues) {
  const list = [];
  for (const i of issues) {
    if (i.pull_request || i.state !== "open") continue;
    const game = cleanGame(field(i.body, "Game") ?? String(i.title ?? "").replace(/^cheats for:\s*/i, ""));
    if (!game) continue;
    list.push({
      game,
      exe: cleanExe(field(i.body, "Game program (optional)")),
      votes: 1 + Math.max(0, Number(i.reactions?.["+1"] ?? 0) || 0),
      number: Number(i.number),
      url: `https://github.com/${repo}/issues/${Number(i.number)}`,
      asked: String(i.created_at ?? "").slice(0, 10),
    });
  }
  list.sort((a, b) => b.votes - a.votes || a.number - b.number);
  return list.slice(0, MAX);
}

function test() {
  const hk =
    "### Game\n\nHollow‮ Knight\n\n### Game program (optional)\n\nhollow_knight.exe\n\n### Which cheats? (optional)\n\n_No response_";
  const w = wantedFrom([
    { number: 4, state: "open", title: "Cheats for: Hollow Knight", body: hk, reactions: { "+1": 2 }, created_at: "2026-11-11T00:00:00Z" },
    { number: 5, state: "open", title: "Cheats for: Coin Quest", body: "### Game\n\nCoin Quest\n\n### Game program (optional)\n\nC:\\evil\\x.exe", reactions: {} },
    { number: 6, state: "open", title: "x", body: "### Game\n\nx", reactions: {} },
    { number: 7, state: "open", pull_request: {}, title: "Cheats for: PR", body: "" },
    { number: 8, state: "closed", title: "Cheats for: Old", body: "### Game\n\nOld" },
  ]);
  const ok =
    w.length === 2 &&
    w[0].game === "Hollow Knight" &&
    w[0].votes === 3 &&
    w[0].exe === "hollow_knight.exe" &&
    w[0].url === `https://github.com/${repo}/issues/4` &&
    w[1].game === "Coin Quest" &&
    w[1].exe === null;
  console.log(ok ? "ok" : `FAIL ${JSON.stringify(w)}`);
  process.exit(ok ? 0 : 1);
}

async function main() {
  const issues = [];
  for (let page = 1; page <= 10; page++) {
    const r = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&labels=request&per_page=100&page=${page}`, {
      headers: { accept: "application/vnd.github+json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
    if (!r.ok) throw new Error(`GitHub answered ${r.status}`);
    const batch = await r.json();
    issues.push(...batch);
    if (batch.length < 100) break;
  }
  const wanted = wantedFrom(issues);
  let old = null;
  try {
    old = JSON.parse(readFileSync("wanted.json", "utf8"));
  } catch {
    /* first run */
  }
  if (old && JSON.stringify(old.wanted) === JSON.stringify(wanted)) {
    console.log(`wanted.json: unchanged (${wanted.length} game(s))`);
    return;
  }
  writeFileSync("wanted.json", JSON.stringify({ format: 1, updated: new Date().toISOString().slice(0, 10), wanted }, null, 2) + "\n");
  console.log(`wanted.json: ${wanted.length} game(s)`);
}

if (process.argv.includes("--test")) test();
else await main();
