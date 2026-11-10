# OpenTrainer community packs

Cheat packs for [OpenTrainer](https://github.com/jackuri/opentrainer), shared by players. The
**Packs** tab in OpenTrainer reads this list. Pick a pack, click **See what's inside**, then
**Install**.

A pack is a small JSON file describing cheats: which game values to change, and which few bytes of
game code to swap. It contains no programs. OpenTrainer checks every pack before installing it, and
refuses games with anti-cheat.

## Add your pack

**The easy way (in OpenTrainer 1.4 or newer):** open **Packs**, click **Share with everyone** next to
your pack, sign in to GitHub once with the code it shows, tick that every cheat works and click
**Share**. OpenTrainer makes the pull request for you. A maintainer checks it, and after merging the
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

## Rules

- **Single-player games only.** No online or multiplayer games, and no games with anti-cheat.
  OpenTrainer refuses those anyway; packs for them are closed.
- **No game files.** A pack holds names, offsets and short byte patterns only. No extracted
  assets, no decompiled code, no executables.
- **Only `pack.json`** in a pack's folder.
- The pack must be valid. OpenTrainer's `otpack validate` must pass, and the check on pull
  requests must be green.
- Mark AI-made packs as such (`"author": "ai"`). OpenTrainer does this for you.
- List the builds you tested (`game.builds` with the exe's SHA-256) when you can, so players see
  "verified for this version".

## Licence

Packs here are shared under the MIT licence (see `LICENSE`). By adding a pack you agree to that.
