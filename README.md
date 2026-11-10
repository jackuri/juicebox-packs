# OpenTrainer community packs

Cheat packs for [OpenTrainer](https://github.com/jackuri/opentrainer), shared by players. The
**Packs** tab in OpenTrainer reads this list. Pick a pack, click **See what's inside**, then
**Install**.

A pack is a small JSON file describing cheats: which game values to change, and which few bytes of
game code to swap. It contains no programs. OpenTrainer checks every pack before installing it, and
refuses games with anti-cheat.

## Add your pack

**The easy way (in OpenTrainer 1.4 or newer):** open **Packs**, click **Share with everyone** next to
your pack, sign in to GitHub once with the code it shows, tick that every cheat works, say who made
it and pick the terms (1.17 or newer), and click **Share**. OpenTrainer makes the pull request for you. A maintainer checks it, and after merging the
list (`index.json`) updates by itself.

**By hand:**

1. In OpenTrainer, make sure the pack works. Load it in **Cheats** and try every cheat.
2. Fork this repository and add your pack as `packs/<game-id>/pack.json`. The folder name must be
   the pack's `game.id`. Get the file from OpenTrainer's pack folder
   (`%APPDATA%\OpenTrainer\packs\<game-id>\pack.json`, or **Packs → Pack folder**).
3. Open a pull request. Don't edit `index.json`: it is rebuilt after merging. Say which game version / store you tested it on.

## Add a link to a Cheat Engine table

Many games have free Cheat Engine tables (`.CT` files) made by players on forums such as
FearLess Revolution. This list can point to them, so OpenTrainer can show "Tables other players
found" for a game (OpenTrainer 1.16 or newer). **Only the link is listed: the table stays on its
maker's page**, and players download it from there, which credits its maker.

**The easy way:** in OpenTrainer, turn a table into cheats (fill in who made it and its page), then
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

## Add cheats for a web game

OpenTrainer 1.19 or newer can share the cheats a player found for a game that runs in a web page
(Web games tab). They're small, so the list carries them whole.

**The easy way:** in OpenTrainer's **Web games** tab, click **Share** next to the game, then
**Share with everyone**.

**By hand:** add `web/<id>.json` (the `.otweb` file OpenTrainer saves has the same contents):

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

## Rules

- **Single-player games only** (packs for PC games). No online or multiplayer games, and no games
  with anti-cheat. OpenTrainer refuses those anyway; packs for them are closed. Web cheats have
  their own rules (above).
- **No game files.** A pack holds names, offsets and short byte patterns only. No extracted
  assets, no decompiled code, no executables.
- **Only `pack.json`** in a pack's folder.
- The pack must be valid. OpenTrainer's `otpack validate` must pass, and the check on pull
  requests must be green.
- Mark AI-made packs as such (`"author": "ai"`). OpenTrainer does this for you.
- List the builds you tested (`game.builds` with the exe's SHA-256) when you can, so players see
  "verified for this version".

## Makers choose their terms

When sharing in OpenTrainer (1.17 or newer), you say who made the cheats and pick the terms:

- **Free to reuse and change (MIT)**: the list's default.
- **Shared with permission; the maker keeps all rights**: players may use the pack, but not
  re-share or sell it elsewhere without the maker's OK.
- **Other terms**: one short line, e.g. `CC BY 4.0`.

The terms are kept in the pack (`meta.source.licence`) and shown in OpenTrainer next to the pack,
with the maker's name, their page and an optional support link (Patreon, Ko-fi, Buy Me a Coffee,
GitHub or YouTube).

**"Shared by its maker" badge:** a pack whose sharer says they made the cheats
(`meta.source.fromMaker`) shows this badge. Maintainers merge such a pack only after checking it,
for example the maker's forum profile or table thread links to the GitHub account that sent it.

## Licence

Packs here are shared under the MIT licence (see `LICENSE`) **unless the pack names other terms in
`meta.source.licence`**: then those terms apply to that pack. By adding a pack you agree to this,
and that you made the pack or its maker agreed to share it under the terms you picked.
