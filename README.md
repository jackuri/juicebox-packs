# JuiceBox Trainer community packs

Cheat packs for [JuiceBox Trainer](https://github.com/jackuri/juicebox-trainer) (formerly OpenTrainer), shared by players. The
**Packs** tab in JuiceBox Trainer reads this list. Pick a pack, click **See what's inside**, then
**Install**.

A pack is a small JSON file describing cheats: which game values to change, and which few bytes of
game code to swap. It contains no programs. JuiceBox Trainer checks every pack before installing it, and
refuses games with anti-cheat.

## Add your pack

**The easy way (in JuiceBox Trainer 1.4 or newer):** open **Packs**, click **Share with everyone** next to
your pack, sign in to GitHub once with the code it shows, tick that every cheat works, say who made
it and pick the terms (1.17 or newer), and click **Share**. JuiceBox Trainer makes the pull request for you. A maintainer checks it, and after merging the
list (`index.json`) updates by itself.

**By hand:**

1. In JuiceBox Trainer, make sure the pack works. Load it in **Cheats** and try every cheat.
2. Fork this repository and add your pack as `packs/<game-id>/pack.json`. The folder name must be
   the pack's `game.id`. Get the file from JuiceBox Trainer's pack folder
   (`%APPDATA%\JuiceBox Trainer\packs\<game-id>\pack.json`, or **Packs → Pack folder**).
3. Open a pull request. Don't edit `index.json`: it is rebuilt after merging. Say which game version / store you tested it on.

## Add a link to a Cheat Engine table

Many games have free Cheat Engine tables (`.CT` files) made by players on forums such as
FearLess Revolution. This list can point to them, so JuiceBox Trainer can show "Tables other players
found" for a game (JuiceBox Trainer 1.16 or newer). **Only the link is listed: the table stays on its
maker's page**, and players download it from there, which credits its maker.

**The easy way:** in JuiceBox Trainer, turn a table into cheats (fill in who made it and its page), then
in **Packs** click **Share the table's link** next to it.

**By hand:** add `tables/<id>.json`:

```json
{
  "id": "hollow-knight-0123456789",
  "game": "Hollow Knight",
  "exe": "hollow_knight.exe",
  "title": "Hollow Knight v1.5 table",
  "by": "The table's maker",
  "url": "https://fearlessrevolution.com/viewtopic.php?t=…",
  "cheats": 12,
  "added": "2026-11-09"
}
```

The page must be the table's own page, over `https`, on fearlessrevolution.com,
forum.cheatengine.org, opencheattables.com or github.com. `exe`, `cheats` and `added` are optional.

### The table itself (only with its maker's OK)

If the table's maker gave it an **open licence** (CC-BY-4.0, CC0-1.0, CC-BY-SA-4.0, MIT, Apache-2.0
or GPL-3.0-or-later) or said it may be shared here, the table itself can be here too, so players turn
it into cheats in one click (JuiceBox Trainer 1.27 or newer). Put it next to its link as
`tables/<id>.CT` and add to the link:

```json
  "licence": "CC-BY-4.0",
  "file": "tables/<id>.CT",
  "sha256": "<SHA-256 of the .CT file>"
```

For the maker's permission, use `"licence": "Shared with permission; all rights kept by the maker"`.
JuiceBox Trainer's **Share the table's link** does all of this when you choose to include the table.
**Maintainers check the licence or permission on the table's own page before merging.** Tables
without one stay on their maker's page: only the link is here. Never copy tables or cheats from paid
trainer apps (WeMod, FLiNG, Cheat Happens and the like).

## Add cheats for a web game

JuiceBox Trainer 1.19 or newer can share the cheats a player found for a game that runs in a web page
(Web games tab). They're small, so the list carries them whole.

**The easy way:** in JuiceBox Trainer's **Web games** tab, click **Share** next to the game, then
**Share with everyone**.

**By hand:** add `web/<id>.json` (the `.juiceweb` file JuiceBox Trainer saves, or `.otweb` from OpenTrainer, has the same contents):

```json
{
  "format": 1,
  "id": "zombie-run-1a2b3c4d5e",
  "game": "Zombie Run",
  "url": "https://zombies.example/play",
  "by": "Who found the cheats",
  "notes": "works from level 2",
  "added": "2026-11-10",
  "cheats": [
    { "name": "Ammo", "target": { "k": "j", "path": ["game", "ammo"] }, "value": 99, "key": "F3" },
    { "name": "Health", "target": { "k": "m", "mem": 0, "label": "module memory", "size": 65536, "off": 4096, "t": "i32" }, "value": 100 }
  ]
}
```

A cheat is a place (`"k": "j"`: a JavaScript value by its path from `window`; `"k": "m"`: an offset
in one of the page's memories, with `t` one of `u8`, `i16`, `i32`, `f32`, `f64`) and the value to
set or lock it to. `key` and `keyDoes` (`lock` or `set`) are optional. The address must be the
game's own `https` page. At most 50 cheats.

Web cheats are for playing alone or in private games with friends you invited. They're not
accepted for competitive games (ranked matches, PvP, leaderboards) or for games where items can be
bought, sold or traded for real money.

## Ratings

Players rate every pack from 1 to 3 stars in JuiceBox Trainer 1.29 or newer: ★ broken, ★★ works
but has bugs, ★★★ works great. Each pack has a **Rate: <pack id>** issue (made by a robot, label
`rating`); a rating is a reaction on it (👍 3 stars, 😕 2, 👎 1; only your newest counts). The robot
counts them every hour into `ratings.json`, and JuiceBox Trainer shows the stars and can put the
best packs first. Found a bug in a pack? Comment on its rating issue: which cheat, your game version
and what happened.

## Ask for cheats

No cheats for a game yet? In JuiceBox Trainer 1.25 or newer, click **Ask the community for cheats** on
the game in **Games**: it opens a [request](https://github.com/jackuri/juicebox-packs/issues/new?template=cheat-request.yml)
here, filled in. Already asked by someone? Add a 👍 to their request instead. The requests with the
most votes show as **Most wanted** in JuiceBox Trainer (`wanted.json`, rebuilt every hour), so players
who have the game can make the cheats with the AI helper and share them. Single-player games (or
their offline mode) only.

## Rules

- **Games without anti-cheat** (packs for PC games): single-player, co-op with friends, and online
  games that have no anti-cheat. No games with anti-cheat: JuiceBox Trainer refuses those anyway, and
  packs for them are closed. Please don't make cheats meant to spoil other players' fun in public,
  competitive or ranked play. Web cheats have their own rules (above).
- **No game files.** A pack holds names, offsets and short byte patterns only. No extracted
  assets, no decompiled code, no executables.
- **Only `pack.json`** in a pack's folder.
- The pack must be valid. JuiceBox Trainer's `juicepack validate` must pass, and the check on pull
  requests must be green.
- Mark AI-made packs as such (`"author": "ai"`). JuiceBox Trainer does this for you.
- List the builds you tested (`game.builds` with the exe's SHA-256) when you can, so players see
  "verified for this version".

## Makers choose their terms

When sharing in JuiceBox Trainer (1.17 or newer), you say who made the cheats and pick the terms:

- **Free to reuse and change (MIT)**: the list's default.
- **Shared with permission; the maker keeps all rights**: players may use the pack, but not
  re-share or sell it elsewhere without the maker's OK.
- **Other terms**: one short line, e.g. `CC BY 4.0`.

The terms are kept in the pack (`meta.source.licence`) and shown in JuiceBox Trainer next to the pack,
with the maker's name, their page and an optional support link (Patreon, Ko-fi, Buy Me a Coffee,
GitHub or YouTube).

**"Shared by its maker" badge:** a pack whose sharer says they made the cheats
(`meta.source.fromMaker`) shows this badge. Maintainers merge such a pack only after checking it,
for example the maker's forum profile or table thread links to the GitHub account that sent it.

## Licence

Packs here are shared under the MIT licence (see `LICENSE`) **unless the pack names other terms in
`meta.source.licence`**: then those terms apply to that pack. By adding a pack you agree to this,
and that you made the pack or its maker agreed to share it under the terms you picked.
