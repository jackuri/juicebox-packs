// Builds ratings.json: how players rate each community pack, from 1 to 3 stars (JuiceBox Trainer
// 1.29.0+ shows it and lets players rate). Every pack gets a "Rate: <pack id>" issue (label
// "rating"); a rating is a reaction on it:
//   👍 (+1)       3 stars: works great
//   😕 (confused) 2 stars: works, with bugs
//   👎 (-1)       1 star:  broken
// One GitHub account counts once per pack (its newest of those reactions). Nothing people write is
// used: only reaction kinds, who reacted, and when.
//
// Usage (in the workflow): GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo node scripts/build-ratings.mjs
// Tests: node scripts/build-ratings.mjs --test
import { readFileSync, writeFileSync } from "node:fs";

const repo = process.env.GITHUB_REPOSITORY ?? "jackuri/juicebox-packs";
const token = process.env.GITHUB_TOKEN;
const STARS = { "+1": 3, confused: 2, "-1": 1 };
const TITLE = "Rate: ";
const slug = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** A pack's rating from its issue's reactions. */
export function tally(reactions) {
  const latest = new Map();
  for (const r of reactions) {
    const stars = STARS[r?.content];
    const who = r?.user?.login;
    if (!stars || typeof who !== "string" || r?.user?.type === "Bot") continue;
    const at = String(r.created_at ?? "");
    const had = latest.get(who);
    if (!had || at > had.at) latest.set(who, { stars, at });
  }
  const votes = [0, 0, 0];
  for (const { stars } of latest.values()) votes[stars - 1] += 1;
  const count = votes[0] + votes[1] + votes[2];
  const stars = count ? Math.round(((votes[0] + 2 * votes[1] + 3 * votes[2]) / count) * 10) / 10 : 0;
  return { count, stars, votes };
}

/** The pack id a rating issue is for, or null. */
export function packOf(issue) {
  const t = String(issue?.title ?? "");
  if (!t.startsWith(TITLE) || issue.pull_request) return null;
  const id = t.slice(TITLE.length).trim();
  const labelled = (issue.labels ?? []).some((l) => (typeof l === "string" ? l : l?.name) === "rating");
  return labelled && slug.test(id) ? id : null;
}

function issueBody(pack) {
  return [
    `Rate **${pack.name}** (\`${pack.exe}\`), version ${pack.packVersion}: did its cheats work for you?`,
    "",
    "The easy way: in JuiceBox Trainer 1.29 or newer, go to **Packs → Community packs** and click the stars on this pack.",
    "",
    "Or react to this post:",
    "- 👍 **3 stars**: works great",
    "- 😕 **2 stars**: works, but has bugs",
    "- 👎 **1 star**: broken",
    "",
    "Only your newest of these counts. Found a bug? Say which cheat, your game version and what happened in a comment.",
  ].join("\n");
}

function test() {
  const r = (who, content, at, type = "User") => ({ user: { login: who, type }, content, created_at: at });
  const t = tally([
    r("ann", "+1", "2026-11-12T01:00:00Z"),
    r("ann", "-1", "2026-11-12T02:00:00Z"), // Ann changed her mind: 1 star
    r("bob", "+1", "2026-11-12T01:00:00Z"),
    r("cy", "confused", "2026-11-12T01:00:00Z"),
    r("cy", "heart", "2026-11-12T03:00:00Z"), // not a rating
    r("bot", "+1", "2026-11-12T01:00:00Z", "Bot"),
    { content: "+1" },
  ]);
  const empty = tally([]);
  const ok =
    t.count === 3 &&
    JSON.stringify(t.votes) === "[1,1,1]" &&
    t.stars === 2 &&
    empty.count === 0 &&
    empty.stars === 0 &&
    packOf({ title: "Rate: coin-quest", labels: [{ name: "rating" }] }) === "coin-quest" &&
    packOf({ title: "Rate: coin-quest", labels: [] }) === null &&
    packOf({ title: "Rate: Bad Id!", labels: ["rating"] }) === null &&
    packOf({ title: "Rate: x", labels: ["rating"], pull_request: {} }) === null;
  console.log(ok ? "ok" : `FAIL ${JSON.stringify({ t, empty })}`);
  process.exit(ok ? 0 : 1);
}

async function api(path, options = {}) {
  const r = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
  });
  if (!r.ok) throw new Error(`GitHub answered ${r.status} for ${path}`);
  return r.json();
}

async function all(path) {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await api(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

async function main() {
  const index = JSON.parse(readFileSync("index.json", "utf8"));
  const packs = (index.packs ?? []).filter((p) => slug.test(p.id));
  const issues = new Map();
  for (const i of await all(`/repos/${repo}/issues?state=all&labels=rating`)) {
    const id = packOf(i);
    if (id && !issues.has(id)) issues.set(id, i);
  }
  // Every pack on the list gets its rating issue.
  for (const p of packs) {
    if (issues.has(p.id)) continue;
    const made = await api(`/repos/${repo}/issues`, {
      method: "POST",
      body: JSON.stringify({ title: `${TITLE}${p.id}`, body: issueBody(p), labels: ["rating"] }),
    });
    issues.set(p.id, made);
    console.log(`made the rating issue for ${p.id}: #${made.number}`);
  }
  const ratings = {};
  for (const p of packs) {
    const issue = issues.get(p.id);
    if (!issue || issue.state !== "open") continue;
    const reactions = await all(`/repos/${repo}/issues/${issue.number}/reactions`);
    ratings[p.id] = { issue: Number(issue.number), ...tally(reactions) };
  }
  let old = null;
  try {
    old = JSON.parse(readFileSync("ratings.json", "utf8"));
  } catch {
    /* first run */
  }
  if (old && JSON.stringify(old.ratings) === JSON.stringify(ratings)) {
    console.log(`ratings.json: unchanged (${Object.keys(ratings).length} pack(s))`);
    return;
  }
  writeFileSync("ratings.json", JSON.stringify({ format: 1, updated: new Date().toISOString().slice(0, 10), ratings }, null, 2) + "\n");
  console.log(`ratings.json: ${Object.keys(ratings).length} pack(s)`);
}

if (process.argv.includes("--test")) test();
else await main();
