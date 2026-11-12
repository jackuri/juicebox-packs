// Builds xp.json: every player's packer XP (JuiceBox Trainer 1.32.0+ shows their level, title and
// the leaderboard). Everything is counted from GitHub itself, so nobody can give themselves XP:
//   10 XP  for each pack or web cheats file of yours accepted into this list (a merged pull request
//          that added packs/<id>/pack.json or web/<id>.json, still listed in index.json);
//    2 XP  for each pack you rated (a 👍 😕 or 👎 reaction on its "Rate: <pack id>" issue; once per
//          pack, your own included; changing your rating doesn't add more);
//    2 XP  for each day you checked in (JuiceBox Trainer 1.33+ adds a reaction to that day's
//          "Check-in: YYYY-MM-DD" issue when you open it; only a reaction GitHub dated that same day
//          (UTC) counts), and 10 XP more for every 5 days in a row.
// The robot opens each day's check-in issue, and closes and locks the ones before. Counted days are
// kept in checkins.json, so old check-in issues needn't be read again.
// Bots don't count. Nothing people write is read: only who opened merged pull requests and which
// files they added, and who reacted on the rating issues.
//
// Levels (shown by the app): level L needs 5 × L × (L − 1) XP in all (10 for level 2, then 10 more
// for each next level than the one before), up to level 99.
//
// Usage (in the workflow): GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo node scripts/build-xp.mjs
// Tests: node scripts/build-xp.mjs --test
import { readFileSync, writeFileSync } from "node:fs";

const repo = process.env.GITHUB_REPOSITORY ?? "jackuri/juicebox-packs";
const token = process.env.GITHUB_TOKEN;
export const XP = { pack: 10, rating: 2, day: 2, streak: 10 };
/** Days in a row for the streak reward. */
export const STREAK = 5;
const CHECK_IN = "Check-in: ";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const RATINGS = new Set(["+1", "confused", "-1"]);
const slug = "[a-z0-9][a-z0-9_-]{0,63}";
const PACK_FILE = new RegExp(`^packs/(${slug})/pack\\.json$`);
const WEB_FILE = new RegExp(`^web/(${slug})\\.json$`);
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const MAX_PLAYERS = 1000;

/** Total XP to reach a level (1 to 99). */
export const xpFor = (level) => 5 * level * (level - 1);
export function levelFor(xp) {
  let level = 1;
  while (level < 99 && xp >= xpFor(level + 1)) level++;
  return level;
}
export const TITLES = [
  [1, "Recruit Packer"],
  [3, "Pack Rat"],
  [5, "Intern Packer"],
  [10, "Pro Packer"],
  [20, "Pack Master"],
  [30, "Leader of the Pack"],
  [45, "Pack King"],
  [60, "Pack Legend"],
  [99, "Pack God"],
];
export const titleFor = (level) => TITLES.filter(([at]) => level >= at).at(-1)[1];

const human = (u) => u && typeof u.login === "string" && LOGIN.test(u.login) && u.type !== "Bot";

/**
 * Everyone's XP. `prs`: merged pull requests, each { user, merged_at, files: [{ filename, status }] };
 * `ratings`: reactions on the rating issues, each { issue, reactions: [...] }; `listed`: pack and web ids
 * on the list now. A pack counts once, for whoever's merged pull request added it first.
 */
/** The day after a "YYYY-MM-DD" day. */
const nextDay = (d) => new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

/** Who checked in on a day: reactions by people, made (as GitHub dates them) on that day. */
export function checkedIn(day, reactions) {
  return [...new Set((reactions ?? []).filter((r) => human(r?.user) && String(r.created_at ?? "").startsWith(day)).map((r) => r.user.login))].sort();
}

/**
 * Check-in days and streaks: `days` (day → logins). For each player, how many days, the reward for
 * every 5 days in a row, and their streak as of `today` (days in a row ending today or yesterday).
 */
export function streaks(days, today) {
  const byPlayer = new Map();
  for (const [day, logins] of Object.entries(days)) {
    if (!DAY.test(day)) continue;
    for (const login of logins) {
      if (!byPlayer.has(login)) byPlayer.set(login, []);
      byPlayer.get(login).push(day);
    }
  }
  const out = new Map();
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  for (const [login, list] of byPlayer) {
    const sorted = [...new Set(list)].sort();
    let bonuses = 0;
    let run = 0;
    let prev = null;
    for (const d of sorted) {
      run = prev && nextDay(prev) === d ? run + 1 : 1;
      if (run % STREAK === 0) bonuses += 1;
      prev = d;
    }
    const last = sorted.at(-1);
    out.set(login, { days: sorted.length, bonuses, streak: last === today || last === yesterday ? run : 0, lastDay: last });
  }
  return out;
}

export function score(prs, ratings, listed, days = {}, today = new Date().toISOString().slice(0, 10)) {
  const players = new Map();
  const get = (login) => {
    if (!players.has(login)) players.set(login, { login, xp: 0, packs: 0, ratings: 0, days: 0, streak: 0, lastDay: null });
    return players.get(login);
  };
  const credited = new Set();
  const merged = prs.filter((p) => p?.merged_at && human(p.user)).sort((a, b) => String(a.merged_at).localeCompare(String(b.merged_at)));
  for (const pr of merged) {
    for (const f of pr.files ?? []) {
      if (f?.status !== "added") continue;
      const id = PACK_FILE.exec(f.filename ?? "")?.[1] ?? WEB_FILE.exec(f.filename ?? "")?.[1];
      const key = id && (PACK_FILE.test(f.filename) ? `pack:${id}` : `web:${id}`);
      if (!id || !listed.has(key) || credited.has(key)) continue;
      credited.add(key);
      const p = get(pr.user.login);
      p.packs += 1;
      p.xp += XP.pack;
    }
  }
  for (const { reactions } of ratings) {
    const who = new Set((reactions ?? []).filter((r) => RATINGS.has(r?.content) && human(r.user)).map((r) => r.user.login));
    for (const login of who) {
      const p = get(login);
      p.ratings += 1;
      p.xp += XP.rating;
    }
  }
  for (const [login, s] of streaks(days, today)) {
    if (!LOGIN.test(login)) continue;
    const p = get(login);
    p.days = s.days;
    p.streak = s.streak;
    p.lastDay = s.lastDay;
    p.xp += s.days * XP.day + s.bonuses * XP.streak;
  }
  return [...players.values()].sort((a, b) => b.xp - a.xp || a.login.localeCompare(b.login)).slice(0, MAX_PLAYERS);
}

function test() {
  const pr = (login, at, files, type = "User") => ({ user: { login, type }, merged_at: at, files: files.map(([status, filename]) => ({ status, filename })) });
  const listed = new Set(["pack:coin-quest", "pack:hero", "web:zombies-1"]);
  const r = (login, content, type = "User") => ({ user: { login, type }, content });
  const players = score(
    [
      pr("ann", "2026-11-10T00:00:00Z", [["added", "packs/coin-quest/pack.json"], ["added", "README.md"]]),
      pr("bob", "2026-11-11T00:00:00Z", [["added", "packs/coin-quest/pack.json"]]), // already Ann's
      pr("bob", "2026-11-12T00:00:00Z", [["modified", "packs/hero/pack.json"], ["added", "web/zombies-1.json"], ["added", "packs/gone/pack.json"]]),
      pr("ann", null, [["added", "packs/hero/pack.json"]]), // not merged
      pr("robot", "2026-11-12T00:00:00Z", [["added", "packs/hero/pack.json"]], "Bot"),
    ],
    [
      { issue: 4, reactions: [r("ann", "+1"), r("ann", "-1"), r("cy", "confused"), r("cy", "heart"), r("bot", "+1", "Bot")] },
      { issue: 5, reactions: [r("ann", "-1"), { content: "+1" }] },
    ],
    listed,
  );
  const want = [
    { login: "ann", xp: 14, packs: 1, ratings: 2, days: 0, streak: 0, lastDay: null },
    { login: "bob", xp: 10, packs: 1, ratings: 0, days: 0, streak: 0, lastDay: null },
    { login: "cy", xp: 2, packs: 0, ratings: 1, days: 0, streak: 0, lastDay: null },
  ];
  // Check-ins: Dee 6 days in a row (2 × 6 + 10), then a gap; Eve 5 then 5 more after a gap (2 × 10 + 20).
  const days = {};
  const add = (login, from, n) => {
    let d = from;
    for (let i = 0; i < n; i++) {
      (days[d] ??= []).push(login);
      d = nextDay(d);
    }
  };
  add("dee", "2026-11-01", 6);
  add("eve", "2026-11-03", 5);
  add("eve", "2026-11-09", 5); // to 2026-11-13: today
  const st = score([], [], new Set(), days, "2026-11-13");
  const dee = st.find((p) => p.login === "dee");
  const eve = st.find((p) => p.login === "eve");
  const late = checkedIn("2026-11-12", [
    { user: { login: "ann" }, created_at: "2026-11-12T23:59:00Z" },
    { user: { login: "bob" }, created_at: "2026-11-13T00:01:00Z" }, // the next day: doesn't count here
    { user: { login: "bot", type: "Bot" }, created_at: "2026-11-12T10:00:00Z" },
    { user: { login: "ann" }, created_at: "2026-11-12T08:00:00Z" },
  ]);
  const ok =
    JSON.stringify(players) === JSON.stringify(want) &&
    dee?.xp === 22 && dee.days === 6 && dee.streak === 0 &&
    eve?.xp === 40 && eve.days === 10 && eve.streak === 5 && eve.lastDay === "2026-11-13" &&
    JSON.stringify(late) === '["ann"]' &&
    xpFor(2) === 10 &&
    xpFor(3) === 30 &&
    levelFor(0) === 1 &&
    levelFor(9) === 1 &&
    levelFor(10) === 2 &&
    levelFor(29) === 2 &&
    levelFor(30) === 3 &&
    levelFor(48510) === 99 &&
    levelFor(10 ** 9) === 99 &&
    titleFor(1) === "Recruit Packer" &&
    titleFor(4) === "Pack Rat" &&
    titleFor(59) === "Pack King" &&
    titleFor(99) === "Pack God";
  console.log(ok ? "ok" : `FAIL ${JSON.stringify(players)}`);
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
  return r.status === 204 ? null : r.json();
}

/**
 * Today's check-in issue is open (made if needed); earlier ones are closed and locked. Returns the
 * counted days (day → logins): from checkins.json, with the last days read again from GitHub.
 */
async function checkIns(today) {
  let kept = {};
  try {
    kept = JSON.parse(readFileSync("checkins.json", "utf8")).days ?? {};
  } catch {
    /* first run */
  }
  const issues = await all(`/repos/${repo}/issues?state=all&labels=check-in`);
  const ofDay = (i) => {
    const t = String(i.title ?? "");
    const d = t.startsWith(CHECK_IN) ? t.slice(CHECK_IN.length).trim() : "";
    return DAY.test(d) && !i.pull_request ? d : null;
  };
  if (!issues.some((i) => ofDay(i) === today)) {
    const made = await api(`/repos/${repo}/issues`, {
      method: "POST",
      body: JSON.stringify({
        title: `${CHECK_IN}${today}`,
        labels: ["check-in"],
        body: [
          `Daily check-in for **${today}** (UTC).`,
          "",
          "JuiceBox Trainer 1.33 or newer adds a 👍 here for you when you open it today, if you turned on the daily check-in (click your level at the bottom of the menu). Every day you check in gives 2 XP, and every 5 days in a row 10 XP more.",
          "",
          "Only reactions made today count. This page closes when the day ends.",
        ].join("\n"),
      }),
    });
    issues.push(made);
    console.log(`made today's check-in: #${made.number}`);
  }
  const days = { ...kept };
  const recent = new Date(Date.parse(`${today}T00:00:00Z`) - 3 * 86400000).toISOString().slice(0, 10);
  for (const i of issues) {
    const d = ofDay(i);
    if (!d || d > today) continue;
    if (!(d in kept) || d >= recent) days[d] = checkedIn(d, await all(`/repos/${repo}/issues/${i.number}/reactions`));
    if (d < today && i.state === "open") {
      await api(`/repos/${repo}/issues/${i.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed" }) });
      await api(`/repos/${repo}/issues/${i.number}/lock`, { method: "PUT", body: JSON.stringify({ lock_reason: "resolved" }) });
    }
  }
  const sorted = Object.fromEntries(Object.entries(days).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync("checkins.json", JSON.stringify({ format: 1, days: sorted }, null, 2) + "\n");
  return sorted;
}

async function all(path) {
  const out = [];
  for (let page = 1; page <= 30; page++) {
    const batch = await api(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

async function main() {
  const index = JSON.parse(readFileSync("index.json", "utf8"));
  const listed = new Set([...(index.packs ?? []).map((p) => `pack:${p.id}`), ...(index.web ?? []).map((w) => `web:${w.id}`)]);
  const prs = [];
  for (const pr of await all(`/repos/${repo}/pulls?state=closed`)) {
    if (!pr.merged_at || !human(pr.user)) continue;
    prs.push({ user: pr.user, merged_at: pr.merged_at, files: await all(`/repos/${repo}/pulls/${pr.number}/files`) });
  }
  const ratings = [];
  for (const i of await all(`/repos/${repo}/issues?state=open&labels=rating`)) {
    if (i.pull_request || !String(i.title ?? "").startsWith("Rate: ")) continue;
    ratings.push({ issue: i.number, reactions: await all(`/repos/${repo}/issues/${i.number}/reactions`) });
  }
  const today = new Date().toISOString().slice(0, 10);
  const days = await checkIns(today);
  const players = score(prs, ratings, listed, days, today);
  let old = null;
  try {
    old = JSON.parse(readFileSync("xp.json", "utf8"));
  } catch {
    /* first run */
  }
  if (old && JSON.stringify(old.players) === JSON.stringify(players)) {
    console.log(`xp.json: unchanged (${players.length} player(s))`);
    return;
  }
  const out = { format: 1, updated: new Date().toISOString().slice(0, 10), rules: XP, players };
  writeFileSync("xp.json", JSON.stringify(out, null, 2) + "\n");
  console.log(`xp.json: ${players.length} player(s)`);
}

if (process.argv.includes("--test")) test();
else await main();
