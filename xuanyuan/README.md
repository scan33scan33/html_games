# 軒轅殘劍 — Xuan-Yuan Sword style RPG

A single-page, zero-build RPG that opens straight in a browser (served statically
via GitHub Pages). No bundler, no npm install — edit a file, refresh the page.

## Project layout

```
xuanyuan/
  index.html     the whole game (state, world, battle, story, audio)
  sprites.js     procedural pixel-art sprite engine  ← sprite development
  assets/        room for future art / data files
  README.md      this file
```

`index.html` loads `sprites.js` first, then runs the game. The game uses
procedural pixel sprites for the common terrain (trees, mountains, village
huts, water) and the player, and falls back to emoji for the rarer special
tiles and for battle monsters.

## Sprite development

Sprites live in `sprites.js` as compact character grids — no image files.
Each sprite is rasterised once to an offscreen canvas and cached, then blitted
crisply (image smoothing off) at any size.

To add or edit a sprite:

1. **Add colours** you need to `PALETTE` (single char → hex; `'.'` = transparent).
2. **Add a grid** to `SPRITES` — an array of equal-length rows of palette chars
   (16×16 is the convention). Rows are auto-sized to the widest row, so a
   miscount degrades gracefully instead of breaking.
3. **Use it**: map a game tile/entity to it. Terrain tiles are wired through the
   `TILE_SPRITE` map in `index.html` (e.g. `f: 'tree'`); the player is drawn with
   `SPR.blitCenter(ctx, 'player', …)`.
4. **Reload.** No build step.

`window.SPR` API:
- `SPR.blit(ctx, name, dx, dy, size)` — draw top-left at (dx,dy), `size`×`size`.
- `SPR.blitCenter(ctx, name, cx, cy, size)` — draw centered on (cx,cy).
- `SPR.has(name)` / `SPR.list()`.

### Roadmap for sprites
Currently pixel-art: `player`, `tree`, `peak`, `house`, `wave`.
Natural next additions: the three party members, per-tier monster sprites for
battle (replacing emoji), dungeon tiles, and the special world icons
(shrine / volcano / pagoda / dark gate / sword-tomb).

## Testing

Headless Playwright playthroughs live in the session scratchpad
(`test_xy.mjs` full quest, `test_xy2.mjs` Act 2 + two-phase finale). Serve the
repo root over HTTP and point them at `/xuanyuan/`.

## Save data

Progress is stored in `localStorage` (`xuanyuanSave`), which is per-origin, so
saves are unaffected by the move into this folder.
