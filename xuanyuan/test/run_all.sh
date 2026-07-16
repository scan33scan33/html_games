#!/usr/bin/env bash
# Run every check. From the repo root:  ./xuanyuan/test/run_all.sh
# Starts its own server on :8765 unless one is already there.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

PORT=8765
started=""
if ! curl -s -o /dev/null "http://localhost:$PORT/xuanyuan/"; then
    python3 -m http.server "$PORT" >/dev/null 2>&1 &
    started=$!
    sleep 1
fi
cleanup() { [ -n "$started" ] && kill "$started" 2>/dev/null; }
trap cleanup EXIT

fail=0
run() {
    printf '\n=== %s ===\n' "$1"
    shift
    if ! "$@"; then fail=$((fail + 1)); fi
}

run "sprites: grids 16x16, palette clean" node xuanyuan/test/lint_sprites.mjs
run "sprites: palette guard fires"        node xuanyuan/test/check_guard.mjs
run "hash: th() is uniform"               node xuanyuan/test/check_hash.mjs
run "music: tracks + triggers"            node xuanyuan/test/check_music.mjs
run "defeat: respawn, no game over"       node xuanyuan/test/check_defeat.mjs
run "save: round-trip + legacy + corrupt" node xuanyuan/test/check_save.mjs
run "quests: both side quests"            node xuanyuan/test/check_quests.mjs
run "shop hint: gear signpost"            node xuanyuan/test/check_shophint.mjs
run "door warning: under-geared"          node xuanyuan/test/check_gearwarn.mjs
run "battle fx: shake/lunge/float/flash"  node xuanyuan/test/check_battlefx.mjs
run "battle idle: monsters breathe"       node xuanyuan/test/check_idle.mjs
run "finale: two phases -> ending"        node xuanyuan/test/check_finale.mjs

# The slow one (~10 min): full critical path, start -> ending. WEAKEN makes the
# boss fights a formality on purpose — this checks that the progression chain
# holds, not that a deliberately bad bot can win a fight. SKIP_PLAY=1 to skip.
if [ "${SKIP_PLAY:-0}" != "1" ]; then
    run "playthrough: start -> ending"    env WEAKEN=1 BUFF=22 node xuanyuan/test/playthrough.mjs
fi

printf '\n----------------------------------------\n'
if [ "$fail" -eq 0 ]; then echo "all checks passed"; else echo "$fail check(s) FAILED"; fi
exit "$fail"
