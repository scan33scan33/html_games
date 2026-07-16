# Test harness

Headless checks for 軒轅殘劍. No test framework — each script is standalone and
prints a report. They drive the real game through the real UI.

## Setup

```bash
python3 -m http.server 8765          # from the repo root, in another shell
npm install playwright-core          # drives the Chrome you already have
```

The Playwright scripts use `channel: 'chrome'`, so there's no browser download.
They assume the game is served at `http://localhost:8765/xuanyuan/`.

## Run everything

```bash
./xuanyuan/test/run_all.sh              # from the repo root; starts its own server
SKIP_PLAY=1 ./xuanyuan/test/run_all.sh  # skip the ~10 min playthrough
```

## The checks individually

```bash
node test/lint_sprites.mjs                      # every grid 16x16, palette clean (all frames)
node test/check_guard.mjs                       # the palette guard actually fires
node test/check_hash.mjs                        # th() is uniform (tile variants/mirroring depend on it)
node test/check_music.mjs                       # tracks well-formed + pentatonic, and which plays where
node test/check_defeat.mjs                      # a wipe respawns at 桃源村, no game over, half gold
node test/check_finale.mjs                      # 玄淵 -> 噬魂 handoff fires and reaches the ending
node test/check_quests.mjs                      # both side quests: rescue -> report -> payout
node test/check_battlefx.mjs                    # hit shake, attacker lunge, damage floats, element flash
node test/check_save.mjs                        # save round-trip, legacy backfill, corrupt save
WEAKEN=1 BUFF=22 node test/playthrough.mjs      # smoke test: the progression chain, start -> ending
node test/playthrough.mjs                       # observation: how a naive player actually fares
```

`lint_sprites.mjs` catches the failure the engine can't: a char with no `PALETTE`
entry (a stray space reads exactly like `.`) draws a transparent hole. It found
three such holes in the original art. It reads the grids through `SPR.grids()` in
a real browser rather than regexing `sprites.js` — the earlier regex version
started reporting the engine's own methods as sprites the moment animation frames
(nested arrays) arrived.

`check_music.mjs` checks each track's pitch-class set against **all twelve**
transpositions of the pentatonic shape — `dungeon` is 羽 mode on D (the F
collection), and a C-only check wrongly flags it.

`playthrough.mjs` walks the map for real, fights every encounter, and follows the
objective tracker. It has two modes, and mixing them up is what made it flaky:

- **`WEAKEN=1 BUFF=22`** — the smoke test. Bosses drop to 1hp, so combat can't
  decide the result and what's under test is the progression chain: recruit →
  three crystals → reforge → two-phase finale → ending. This is what `run_all.sh`
  runs, and it should pass every time.
- **no flags** — observation, not a test. Measures how a naive attack-only player
  fares. It's *allowed* to fail; the failure is the datapoint.

Asking a deliberately-bad bot to win boss fights and calling the result a test
gives you a coin flip that reports "the game is broken" half the time.

See the "Testing" section of the parent README for the traps this harness had to
work around.

**Read the bot's losses sceptically.** It plays badly on purpose (attack, heal
only under 45%, never casts). Two rounds of its "findings" turned out to be its
own bugs:

- it couldn't heal at all — the hero card renders `氣血 45 · 真氣 12` with no
  maximum, so scraping `45/120` out of the DOM silently yielded "always full
  health", and it died to 師尊殘影 at max level. It reads `heroStats(h).maxhp`
  via the page globals now.
- then it hung instead: `allyTargetMode()` renders hero buttons into `#cmds`,
  not `#partyPanel`, so clicking a hero *card* selected nothing and it sat in
  target mode forever.

- and then it lost anyway, because it was buying 金創藥 (+50) while the tier-4
  bosses hit for 52–66 — it was healing slower than it was being hit, which
  looked exactly like "the tomb boss is overtuned". Giving it 大還丹 (+150,
  stocked from tier 2) turned a 2-in-3 wipe rate into 3-for-3 clean kills. It
  buys the biggest heal first now.

So: if a boss "wipes a level-22 party", suspect the bot before the balance —
check `potionsUsed`/`potionsBought` and `stuckBattles` in the STATS line first.
`stuckBattles` counts only battles the turn cap ran out on; don't re-implement
it as "is `#battle` visible afterwards", because draining the phase-1 victory
dialogue is what *starts* the finale's phase 2, and that reads as a false hang.

The bot still never casts, never defends, and never revives, so it remains a
floor on the game's difficulty, not a measure of it.
