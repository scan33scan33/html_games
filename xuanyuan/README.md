# 軒轅殘劍 — Xuan-Yuan Sword style RPG

A single-page, zero-build RPG that opens straight in a browser (served statically
via GitHub Pages). No bundler, no npm install — edit a file, refresh the page.

## Project layout

```
xuanyuan/
  index.html       the whole game (state, world, battle, story, audio)
  sprites.js       procedural pixel-art sprite engine  ← sprite development
  spritesheet.html dev tool: every sprite, on its in-game background
  test/            headless checks (see test/README.md)
  assets/          room for future art / data files
  README.md        this file
```

`index.html` loads `sprites.js` first, then runs the game. All terrain, the
party, and every monster are procedural pixel sprites; emoji remain only as a
fallback for anything without art yet (and if `sprites.js` fails to load).

## Sprite development

Sprites live in `sprites.js` as compact character grids — no image files.
Each sprite is rasterised once to an offscreen canvas and cached, then blitted
crisply (image smoothing off) at any size.

To add or edit a sprite:

1. **Add colours** you need to `PALETTE` (single char → hex; `'.'` = transparent).
2. **Add a grid** to `SPRITES` — an array of equal-length rows of palette chars
   (16×16 is the convention). Rows are auto-sized to the widest row, so a
   miscount degrades gracefully instead of breaking. A char with no `PALETTE`
   entry draws transparent and logs a console warning — a stray space looks
   exactly like a `.`, so it warns rather than silently punching a hole.
3. **Use it**: map a game tile/entity to it. Terrain tiles are wired through the
   sprite maps in `index.html` (see below); the player is drawn with
   `SPR.blitCenter(ctx, 'player', …)`.
4. **Reload** and check `spritesheet.html`. No build step.

### Animation

A sprite is **either one grid or a list of grids**, one per frame:

```js
player: [[ /* frame 0 */ ], [ /* frame 1 */ ], [ /* frame 2 */ ]],
wave:   [[ ... ], [ ... ], [ ... ], [ ... ]],
tree:   [ '................', ... ]        // still a plain grid — unchanged
```

Every static sprite keeps working; `frames()` normalises both shapes. `blit`'s
`frame` argument **wraps**, so callers pass a free-running counter and ignore the
frame count. Animation is driven by the caller, not the engine:

- the **player** has 3 frames (stood / left foot up / right foot up) and walks by
  cycling `WALK_SEQ = [0,1,0,2]` while `t - lastMoveAt < WALK_HOLD`.
- **terrain** animates off the clock, offset by the per-tile hash, so a lake
  ripples instead of pulsing in lockstep.

`window.SPR` API:
- `SPR.blit(ctx, name, dx, dy, size, flip, frame)` — draw top-left at (dx,dy),
  `size`×`size`; `flip` mirrors horizontally; `frame` wraps.
- `SPR.blitCenter(ctx, name, cx, cy, size, flip, frame)` — centered on (cx,cy).
- `SPR.add(name, rows)` — register/replace a sprite at runtime (grid or frame
  list), for trying art from the console without editing the file.
- `SPR.frames(name)` — frame count (1 for a static grid).
- `SPR.grids(name)` / `SPR.palette()` — raw data, for tooling.
- `SPR.tag(name, size)` — an `<img>` string for the DOM battle UI (frame 0).
- `SPR.has(name)` / `SPR.list()`.

### Wiring a tile

A map char alone is **not** enough to pick a sprite: some chars mean different
things on different maps (`B` is a volcano outdoors but a boss underground; `S`
is the start clearing outdoors but the exit door underground). So `index.html`
splits the lookup:

- `TILE_SPRITE` — chars that mean the same thing on both maps (`f`, `^`, `w`, …)
- `WORLD_SPRITE` — world-only (`A` shrine, `B` volcano, `C` pagoda, `J` tomb,
  `K` gate, `n` nest, `x` camp)
- `DUNGEON_SPRITE` — dungeon-only (`T` chest, `S` door, `l` lava)

Tile background colours come from `tileBase()`, not `TCOLORS` directly —
dungeons override the floor per-dungeon (`DFLOOR`) so the world's grass green
doesn't leak inside a volcano.

To fight tiling repetition: `FLIPPABLE` chars get mirrored on a per-tile hash,
and `tree`/`peak` swap to `tree2`/`peak2` variants on the same hash.

`th(x, y, n)` is that hash — deterministic, returns `[0, 1)`. It must use
`Math.imul` and unsigned shifts: written with a plain `*`, the intermediate
overflows 2^53 and the low bits round away before they can be mixed, and it
silently returns `< 0.5` for *every* tile. That skew is invisible for scattered
texture specks, which is how it survived — but it made mirroring fire on 100% of
tiles (i.e. do nothing) and skewed the variant split to 82/18. If you touch
`th()`, check the distribution, don't eyeball it.

### Where the graphics stand

Compared against the sibling games in this repo (the only fair comparison — same
medium, same zero-build constraint, and they can actually be run side by side):

| game | approach |
|---|---|
| `crystalquest` | emoji on flat colour — this is 軒轅殘劍's direct ancestor (same Auron, same three crystals) |
| `chipquest` | flat grid tiles + emoji |
| `invaders` | emoji sprites over a starfield, with particles |
| `tetris` / `breakout` | flat rectangles |
| `rpg` | DOM menus, one emoji |
| **`xuanyuan`** | procedural pixel sprites, textured terrain, per-tile variants + mirroring, dithered terrain seams, ambient particles, vignette |

It is comfortably the most developed renderer here. The honest remaining gaps are
against 16-bit console RPGs, not against anything in this folder:

- **animation is thin** — the player has a walk cycle and water ripples, but the
  party members, monsters and torches are all still single frames, and there are
  no attack/hurt frames.
- **no autotiling** — `blendEdges()` dithers terrain seams, but real transition
  tiles (cliff edges, shorelines) would do more.
- **battle is DOM**, so it can't do sprite motion, hit flashes, or screen shake.
  This is the biggest one: it's where the player spends ~35 of the ~60 minutes.

### Roadmap for sprites
Everything on the original roadmap is now pixel art: terrain, the three party
members, all monsters and bosses, dungeon tiles (chest / door / lava) and the
world landmarks (shrine / volcano / pagoda / sword-tomb / dark gate / nest /
camp).

The engine now supports animation frames (see above); `player` and `wave` use
them. Natural next additions: walk frames for 墨璃/青璇, attack/hurt frames for
the monsters, animated lava and torches, and interior tiles for the towns (which
are still menu screens rather than walkable maps).

## Balance note

The healing tiers gate the late game more than levels do. 金創藥 heals +50; the
tier-4 bosses (師尊殘影 atk 52, 玄淵 58, 噬魂 66) out-damage it outright, so a
player who never upgrades past the starter potion loses on arithmetic no matter
how much they grind. 大還丹 (+150, stocked from tier 2) is the intended answer,
alongside 回春術/兼愛無疆 and 機關盾. That's fair design — but the difficulty
cliff is really an *inventory* cliff, and the game used to never say so: 大還丹
appeared exactly once in the source, in the shop list, and no character mentioned
it. The 船夫 now spells it out when the third crystal lands, which is the last
town visit before the spike.

Two things worth knowing if you tune this:

- **The endgame's nearest town is the one that can't equip you for it.** The map
  is fully open — you can walk back and restock whenever — but 劍塚 and 幽都之門
  sit 28 and 21 steps from 桃源村, which is tier 1 and stocks only 金創藥.
  大還丹 needs tier 2+, i.e. a 39-step trip back to 青丘寨 or 42 to 望川鎮. So
  the convenient restock is the one that can't carry you, which is worth knowing
  before nudging any numbers.
- The unbuffed bot (`node test/playthrough.mjs`) reliably dies there. It never
  casts, never defends, never revives, never returns to town to restock, and
  can't afford much 大還丹 — treat it as a floor on the difficulty, not a
  measure of it.

## Story shape

Three acts hung off the three crystals, then a reforge, then a two-phase finale.
The twist is seeded rather than sprung: 玄淵 and 噬魂 are both named in the
opening, the crystal visions reveal across the middle (the sword was *undone from
within*, by the mentor they'd already held a funeral for), and the payoff —
同持, "don't let one person carry it alone" — lands in the last scene and is what
the 憶/`ending` themes are about.

The finale is the fragile part: beating 玄淵 hands off, **through a dialogue
callback**, to 噬魂・借體 wearing his body, and only beating that calls
`showEnding()`. Nothing about that chain is enforced by types — if a `say()`
callback stops firing, the game just quietly stops before its ending.
`test/check_finale.mjs` exists to catch exactly that.

## Music

All music is generated live with the WebAudio API — no audio files. `TRACKS` in
`index.html` holds one entry per track: 8 bars × 8 steps of `lead`, an 8-bar
`bass`, 8 `chords`, and an 8-step `drums` string (`k` kick, `h` hat, `-` rest).
Pitches are MIDI numbers, `0` = rest. `step` is seconds per step.

| track | where it plays |
|---|---|
| `title` | title screen |
| `overworld` / `town` | world map / 桃源村 |
| `fox` / `desert` | 青丘寨 / 望川鎮 |
| `dungeon` / `forge` | dungeons / 劍塚 |
| `battle` / `boss` | random fights / boss fights |
| `memory` | 憶 — remembrance visions |
| `ending` | the ending |

`mapTrack()` picks the ambient track for the map you're on; `TOWN_TRACK` maps a
town id to its theme. Add a track by adding a `TRACKS` entry and pointing
something at it.

**House style.** Melodies are original, written in the Taiwanese folk/ballad
idiom — studied for its devices, never transcribed. (Most of the obvious
reference songs are also still in copyright, so transcription is off the table
regardless.) The devices in use:

- **anhemitonic pentatonic** (宮商角徵羽) — no 4th or 7th degree. Note this is a
  *shape*, not fixed notes: `dungeon` is 羽 mode on D (D F G A C), which is the
  F-pentatonic collection. Any transposition is fine; mixing in a 4th/7th is not.
- **起承轉合** — four two-bar phrases (open / answer / turn / resolve). The 轉
  at bars 5–6 is where the mode darkens or the register jumps.
- **stepwise descent into the cadence**, landing the tonic on a long note.
- **羽 mode for grief, 宮 for warmth** — `desert` and `forge` are 羽; `title` and
  `ending` are 宮.
- **motif callbacks** — 玄淵's descending A-G-E-C hides in the town theme's last
  bar and drives `boss`; `ending` opens on `memory`'s exact first phrase and then
  refuses its falling cadence, climbing an octave instead.

## Testing

```bash
npm install playwright-core             # once; drives the Chrome you already have
./xuanyuan/test/run_all.sh              # everything (starts its own server)
SKIP_PLAY=1 ./xuanyuan/test/run_all.sh  # skip the ~10 min full playthrough
```

The game itself stays zero-build — this is only for the harness, and
`node_modules/` is gitignored. See `test/README.md` for the individual checks.

`window.DBG` is the test seam: `DBG.state()`, `DBG.tp(x,y)`, `DBG.buff(lv)`,
`DBG.noEnc()`, `DBG.maps`, `DBG.track()`, `DBG.boss(id)`, `DBG.weaken()`.

Things that bite when scripting a playthrough — all learned the hard way:

- **A party wipe is not a game over.** `defeat()` silently respawns you at 桃源村
  with half your gold, so a bot that watches for a title screen will never notice
  it died; watch for the `隊伍全滅` dialogue instead.
- **Beating a boss auto-exits the dungeon** (via the crystal vision), so the map
  changes underneath you mid-script.
- **`DBG.crystals()` implies the bosses are dead** — `bossDown()` is derived from
  the crystals, so handing them out makes dungeons refuse entry as "already
  cleared".
- **Enemies are `.enemy` divs, not buttons.** Clicking a `#cmds button` while
  targeting hits 返回 and cancels the attack — an easy infinite loop.
- **Dungeon entry fires on a step**, not on arrival: teleporting onto the tile
  with `DBG.tp` does nothing. Walk in.
- **Route around tiles you don't want**: outdoors, every town/dungeon/event tile
  triggers on contact; indoors, the `S` tile is a trapdoor back to the world.
- **`DMAPS.tomb` is assigned separately** from the `DMAPS` literal, so grepping
  the literal will wrongly suggest 劍塚 has no map.
- **`DBG.boss(id)` drops you into the fight without the dungeon's story context.**
  It now also parks you on that dungeon's entry tile (it used to leave `S.dpos`
  null, so the draw after the battle threw in `curPos()`), but it's still only
  for probing a single fight — walk in properly to test post-victory flow.
- **Ally targeting renders into `#cmds`**, not `#partyPanel` — so does the item
  menu. Clicking a hero *card* selects nothing and hangs the turn.
- **Party roster and `flags.recruited` are separate.** `townTalk()` branches on
  the flag, so a test that pushes a hero onto `S.party` without setting the flag
  gets re-recruited and never reaches the later dialogue branches.

### How long the game actually is

Measured over several bot runs of the critical path (recruit → 3 crystals →
reforge → two-phase finale), fighting every encounter it walked into:

| | per run |
|---|---|
| battles | ~51 (~270 turns) |
| steps walked | ~550 (BFS-optimal; a person wanders more) |
| dialogue | ~140 unique screens, ~3,800–4,000 characters |
| chests | ~15 |

Priced at human speed — Chinese prose at ~350 chars/min ≈ 11 min of reading, and
~270 battle turns at 6–8s each ≈ 30–35 min, plus menus and navigation — that
lands around **an hour for a first playthrough**, and more for anyone who
explores, does the side quests, or dies. The bot is the floor, not the average.

## Save data

Progress is stored in `localStorage` (`xuanyuanSave`), which is per-origin, so
saves are unaffected by the move into this folder.
