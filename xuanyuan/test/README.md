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
node test/check_gearwarn.mjs                    # 墨璃 warns once at the dungeon door if under-geared
node test/check_battlefx.mjs                    # hit shake, attacker lunge, damage floats, element flash
node test/check_idle.mjs                        # monsters breathe between hits, staggered, dead stop
node test/report_curve.mjs                      # (report) gear/level vs each boss
node test/report_gold.mjs                       # (report) does the path pay for the gear?
node test/report_fights.mjs                     # (report) win-rate by gear+potions, first boss and finale
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

## A check that can't fail is worse than none

Three of these checks (`check_defeat`, `check_music`'s wiring half, `check_guard`)
originally only `console.log`'d what they found and never asserted — so they sat
in `run_all.sh` looking like coverage while passing unconditionally. You could
point the title screen at the wrong track, or delete the whole defeat-respawn
behaviour, and they stayed green. They exit non-zero now.

They were caught by **mutation testing**, which is the only honest way to trust a
check: break the thing it covers and confirm it goes red. Every `check_*.mjs`
here has been verified to fail against a deliberate mutation of its target — if
you add one, do the same, or you don't actually know it works. (`report_*.mjs`
are exempt: they're reports, not checks, and always exit 0 by design.)

## Read the bot's losses sceptically — but not indefinitely

**Six times running, this bot "found a balance problem" and the bug was in the
bot.** Then on the seventh it was telling the truth, and the broken instrument
was the *model I was checking it against* — `report_curve.mjs` had the enemy
hitting for `atk - def` when the game does `atk * 2 - def`, which halves every
incoming hit and makes every boss look twice as friendly as it is. The bot's
wipes had been real signal for hours while that error kept explaining them away.

So: check the bot's plumbing first (below), but if it keeps reporting the same
loss after you've fixed the plumbing, **believe it** and go re-read the formula
in `index.html`, not the bot. A hypothesis that's been right six times is exactly
the one you'll forget to re-test.

The six real bot bugs, each of which looked exactly like "the game is too hard":

1. **It couldn't heal.** The hero card renders `氣血 45 · 真氣 12` with no
   maximum, so scraping `45/120` out of the DOM silently yielded "always full
   health" — it never once drank a potion, and died to 師尊殘影 at max level. It
   reads `heroStats(h).maxhp` via the page globals now.
2. **Then it hung instead.** `allyTargetMode()` renders hero buttons into
   `#cmds`, not `#partyPanel`, so clicking a hero *card* selected nothing and it
   sat in target mode forever — which then poisoned every later stage with
   "mode=battle".
3. **Then it lost anyway**, because it bought 金創藥 (+50) while the tier-4
   bosses hit for 52–66. It was healing slower than it was being hit. 大還丹
   (+150) turned a 2-in-3 wipe rate into 3-for-3 clean kills.
4. **And the real one: it bought no equipment at all.** 鏽劍 is +2 atk, 湛盧 is
   +30, and the level curve only adds ~2 atk a level — gear swings these fights
   far harder than levels do. An unequipped bot losing says nothing about the
   balance. It buys gear before potions now.
5. **Then the fix for (4) didn't fire.** A flat 400兩 "keep some money for
   potions" float can never be cleared by the opening 150兩 purse, so it bought
   nothing, all game, and the run looked like evidence when it was a no-op. The
   float scales with the purse now (`floatFor`). Check `gearBought` is non-zero
   before believing any unbuffed run.

So if a boss "wipes a level-22 party": suspect the bot first, and check
`gearBought` / `potionsBought` / `potionsUsed` / `stuckBattles` in the STATS line
before touching a single stat. `stuckBattles` counts only battles the turn cap
ran out on — don't re-implement it as "is `#battle` visible afterwards", because
draining the phase-1 victory dialogue is what *starts* the finale's phase 2, and
that reads as a false hang.

The bot casts heals, revives and buys gear now, but still never defends, never
uses the 五行符, and never captures monsters. It is a **floor** on the difficulty,
not a measure of it. `report_curve.mjs` and `report_gold.mjs` are the honest way
to reason about balance; the bot is only good for "does the chain still hold".
