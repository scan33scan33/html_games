// Play 軒轅殘劍 end to end through the real UI and count what a player actually does.
// Walks the map for real (no teleporting past content), fights every encounter,
// and follows the objective tracker's critical path.
import { chromium } from 'playwright-core';

const t0 = Date.now();
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 520, height: 460 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));

// Two different jobs, don't conflate them:
//   WEAKEN=1 BUFF=22 -> smoke test. Bosses are dropped to 1hp so combat can't
//                       decide the outcome, and what's under test is purely the
//                       progression chain: recruit -> crystals -> reforge ->
//                       two-phase finale -> ending. Deterministic.
//   (no flags)       -> observation. How a naive attack-only player fares.
//                       Allowed to fail; that's the datapoint.
// Without WEAKEN the chain test is flaky, because it ends up measuring whether a
// deliberately bad bot can win a boss fight — which is not what it's for.
const BUFF = Number(process.env.BUFF || 0);
const WEAKEN = process.env.WEAKEN === '1';
const stats = { battles: 0, battleTurns: 0, steps: 0, dialogScreens: 0, dialogChars: 0,
                townVisits: 0, chests: 0, innRests: 0, wipes: 0, potionsUsed: 0, potionsBought: 0,
                stuckBattles: 0, spellHeals: 0, revives: 0, gearBought: 0, lvAtBoss: {} };
const seenDialog = new Set();
const log = [];

const vis = sel => page.isVisible(sel).catch(() => false);
const st = () => page.evaluate(() => { const s = DBG.state(); return { mode: s.mode, dungeonId: s.dungeonId, gold: s.S && s.S.gold, lv: s.S && s.S.party[0].lv, party: s.S && s.S.party.length }; });

async function drainDialog(max = 300) {
    for (let i = 0; i < max; i++) {
        if (!(await vis('#dialog'))) return;
        const txt = await page.locator('#dialogBox').innerText().catch(() => '');
        if (txt) {
            stats.dialogScreens++;
            // a party wipe has no game-over screen — defeat() just respawns you at
            // 桃源村, so this dialogue is the only way to notice it happened
            if (txt.includes('隊伍全滅')) { stats.wipes++; log.push('  *** PARTY WIPED -> respawn at 桃源村'); }
            if (!seenDialog.has(txt)) {
                seenDialog.add(txt);
                stats.dialogChars += txt.replace(/[\s\n]|▼ 點擊繼續/g, '').length;
            }
        }
        await page.keyboard.press('Enter');
        await page.waitForTimeout(55);
    }
}

// HP fraction of the hero whose turn it is, or 1 if we can't tell.
// The game's functions are globals, so ask heroStats() directly — the hero card
// renders "氣血 45 · 真氣 12" with no max, so there is nothing to scrape.
const actingHp = () => page.evaluate(() => {
    const s = DBG.state();
    if (!s.B || s.B.heroIdx == null) return 1;
    const h = s.S.party[s.B.heroIdx];
    if (!h) return 1;
    const st = heroStats(h);
    return st.maxhp ? h.hp / st.maxhp : 1;
}).catch(() => 1);

// Are we picking a target? allyTargetMode/targetMode both render a 返回 button
// into #cmds; the command menu never does. Without this you can't tell "the
// spell queued itself" from "it wants a target", and you end up clicking 攻擊
// for the *next* hero by accident.
const inTargetMode = () =>
    page.locator('#cmds button', { hasText: '返回' }).first().isVisible().catch(() => false);

// Cast the best healing spell available. Returns true if it took the turn.
async function tryHealSpell() {
    const sp = page.locator('#cmds button', { hasText: '法術' }).first();
    if (!(await sp.isVisible().catch(() => false))) return false;
    await sp.click();
    await page.waitForTimeout(70);
    // 金創術 is deliberately NOT here: it heals 16, which is less than a single
    // hit from any boss, so casting it is strictly worse than swinging. Only real
    // heals are worth a turn.
    for (const name of ['兼愛無疆', '回春術']) {
        const b = page.locator('#cmds button', { hasText: name }).first();
        if (!(await b.isVisible().catch(() => false))) continue;
        if (await b.isDisabled().catch(() => false)) continue;   // not enough 真氣
        await b.click();
        await page.waitForTimeout(70);
        if (await inTargetMode()) {
            // single-target heal: pick the most hurt living ally
            const idx = await page.evaluate(() => {
                const s = DBG.state();
                let best = -1, worst = 2;
                s.S.party.forEach((h, i) => {
                    if (h.hp <= 0) return;
                    const f = h.hp / heroStats(h).maxhp;
                    if (f < worst) { worst = f; best = i; }
                });
                return best;
            }).catch(() => 0);
            const allies = page.locator('#cmds button').filter({ hasNotText: '返回' });
            const n = await allies.count();
            await allies.nth(Math.max(0, Math.min(idx, n - 1))).click().catch(() => {});
        }
        stats.spellHeals++;
        await page.waitForTimeout(160);
        return true;
    }
    const back = page.locator('#cmds button', { hasText: '返回' }).first();
    if (await back.isVisible().catch(() => false)) { await back.click().catch(() => {}); await page.waitForTimeout(60); }
    return false;
}

// Revive a fallen ally: 起死回生 if anyone can cast it, else 還魂香.
async function tryRevive() {
    const anyDown = await page.evaluate(() =>
        DBG.state().S.party.some(h => h.hp <= 0)).catch(() => false);
    if (!anyDown) return false;
    const sp = page.locator('#cmds button', { hasText: '法術' }).first();
    if (await sp.isVisible().catch(() => false)) {
        await sp.click();
        await page.waitForTimeout(70);
        const b = page.locator('#cmds button', { hasText: '起死回生' }).first();
        if (await b.isVisible().catch(() => false) && !(await b.isDisabled().catch(() => false))) {
            await b.click();
            await page.waitForTimeout(70);
            if (await inTargetMode()) {
                const allies = page.locator('#cmds button').filter({ hasNotText: '返回' });
                if (await allies.count()) await allies.first().click().catch(() => {});
            }
            stats.revives++;
            await page.waitForTimeout(160);
            return true;
        }
        const back = page.locator('#cmds button', { hasText: '返回' }).first();
        if (await back.isVisible().catch(() => false)) { await back.click().catch(() => {}); await page.waitForTimeout(60); }
    }
    return false;
}

async function fight() {
    stats.battles++;
    let resolved = false;
    // In smoke-test mode, gut the enemies so the chain is what's under test.
    if (WEAKEN) { await page.evaluate(() => DBG.weaken()).catch(() => {}); }
    for (let turn = 0; turn < 150; turn++) {
        if (!(await vis('#battle'))) { resolved = true; break; }
        if (WEAKEN) await page.evaluate(() => DBG.weaken()).catch(() => {});
        if (await vis('#dialog')) { await drainDialog(20); continue; }
        // Recover from a half-finished menu before deciding anything. Any of the
        // branches below can bail out mid-flow (a spell turns out to be
        // unaffordable, a target list is empty), and a turn left parked in target
        // mode never ends — that alone was 6 hung battles in one run.
        if (await inTargetMode()) {
            await page.locator('#cmds button', { hasText: '返回' }).first().click().catch(() => {});
            await page.waitForTimeout(60);
        }
        // Turn priority, roughly how a person plays: pick someone up, keep
        // everyone alive, then swing. A bot that only ever attacks dies to
        // bosses a person would comfortably beat.
        if (await tryRevive()) continue;
        const hurt = await actingHp();
        // Potions BEFORE spells, because the numbers say so: 金創藥 heals 50 and
        // 大還丹 150, while the only heal spell before lv9 is 金創術 at *16* —
        // less than one hit from any boss. Casting it burns the turn to gain
        // ~5hp net, which is how the bot used to heal itself to death.
        if (hurt < 0.55) {
            const items = page.locator('#cmds button', { hasText: '物品' }).first();
            if (await items.isVisible().catch(() => false)) {
                await items.click().catch(() => {});
                await page.waitForTimeout(60);
                let potion = page.locator('#cmds button', { hasText: '大還丹' }).first();
                if (!(await potion.isVisible().catch(() => false)))
                    potion = page.locator('#cmds button', { hasText: '金創藥' }).first();
                if (await potion.isVisible().catch(() => false)) {
                    await potion.click().catch(() => {});
                    await page.waitForTimeout(60);
                    // allyTargetMode() renders the hero buttons into #cmds, NOT
                    // #partyPanel — clicking a hero *card* selects nothing and
                    // leaves the bot parked in target mode forever.
                    const ally = page.locator('#cmds button').filter({ hasNotText: '返回' }).first();
                    if (await ally.isVisible().catch(() => false)) {
                        await ally.click().catch(() => {});
                        stats.potionsUsed++;
                        await page.waitForTimeout(180);
                        continue;
                    }
                }
                // out of potions, or the menu wasn't what we expected: back out
                // and just swing, rather than looping on the item menu
                const back = page.locator('#cmds button', { hasText: '返回' }).first();
                if (await back.isVisible().catch(() => false)) {
                    await back.click().catch(() => {});
                    await page.waitForTimeout(60);
                }
            }
            // No potions left — now a spell is worth the turn. 回春術 (45) and
            // 兼愛無疆 (30, whole party) are real heals; tryHealSpell reaches for
            // the biggest first and gives up if only the 16pt one is known.
            if (await tryHealSpell()) continue;
        }
        const atk = page.locator('#cmds button', { hasText: '攻擊' }).first();
        if (await atk.isVisible().catch(() => false)) {
            stats.battleTurns++;
            await atk.click().catch(() => {});
            await page.waitForTimeout(50);
            // enemies are .enemy divs, not buttons — clicking a #cmds button here
            // would hit 返回 and cancel the attack
            const tgt = page.locator('#enemyRow .enemy:not(.dead)').first();
            if (await tgt.isVisible().catch(() => false)) await tgt.click().catch(() => {});
        }
        await page.waitForTimeout(150);
    }
    // Report only a battle we genuinely failed to end within the turn cap.
    // Don't test '#battle' visibility after this drain: draining the phase-1
    // victory dialogue is what STARTS the finale's phase 2, so a battle being
    // open here is normal, not a hang.
    if (!resolved) {
        log.push('  !!! STUCK in battle — bot could not resolve it within 150 turns');
        stats.stuckBattles++;
    }
    await drainDialog(40);
}

async function step(dir) {
    await page.keyboard.press(dir);
    stats.steps++;
    await page.waitForTimeout(40);
    if (await vis('#battle')) await fight();
    if (await vis('#dialog')) await drainDialog();
}

// Walk to (tx,ty) on the CURRENT map. Aborts if the map changes underfoot —
// otherwise a stray dungeon exit leaves us BFS-ing dungeon coords on the world map.
async function walkTo(tx, ty, budget = 800) {
    // settle any pending dialogue before sampling the starting map, or the
    // mode-change guard below fires on 'dialog' -> 'dungeon' immediately
    await drainDialog();
    const start = await st();
    for (let i = 0; i < budget; i++) {
        if (await vis('#dialog')) await drainDialog();
        if (await vis('#battle')) await fight();
        const p = await page.evaluate(() => {
            const s = DBG.state();
            const pos = s.mode === 'dungeon' ? s.S.dpos : s.S;
            return { x: pos.x, y: pos.y, mode: s.mode, dungeonId: s.dungeonId };
        });
        if (p.x === tx && p.y === ty) return true;
        if (p.mode !== 'world' && p.mode !== 'dungeon') return false;
        if (p.mode !== start.mode || p.dungeonId !== start.dungeonId) {
            log.push(`  (map changed under walkTo -> ${p.mode}/${p.dungeonId}, aborting)`);
            return false;
        }
        const dir = await page.evaluate(({ tx, ty }) => {
            const s = DBG.state();
            const m = s.mode === 'dungeon' ? DBG.maps.DMAPS[s.dungeonId] : DBG.maps.WORLD;
            const pos = s.mode === 'dungeon' ? s.S.dpos : s.S;
            const BLK = { '~': 1, '^': 1, '#': 1, l: 1, w: 1 };
            // inside a dungeon, the exit door is a trapdoor back to the world —
            // never route through it unless it IS the target
            if (s.mode === 'dungeon' && !(m[ty][tx] === 'S')) BLK.S = 1;
            // outdoors, every town/dungeon/event tile fires on contact, so route
            // around the ones we aren't deliberately heading for
            if (s.mode === 'world') for (const c of '123ABCJKnx') if (m[ty][tx] !== c) BLK[c] = 1;
            const W = m[0].length, H = m.length, key = (x, y) => y * W + x;
            const prev = new Map([[key(pos.x, pos.y), null]]);
            const q = [[pos.x, pos.y]];
            let found = false;
            while (q.length) {
                const [x, y] = q.shift();
                if (x === tx && y === ty) { found = true; break; }
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                    if (BLK[m[ny][nx]] && !(nx === tx && ny === ty)) continue;
                    if (prev.has(key(nx, ny))) continue;
                    prev.set(key(nx, ny), [x, y]);
                    q.push([nx, ny]);
                }
            }
            if (!found) return null;
            let cur = [tx, ty], back = prev.get(key(tx, ty));
            while (back && !(back[0] === pos.x && back[1] === pos.y)) { cur = back; back = prev.get(key(back[0], back[1])); }
            if (!back) return null;
            const dx = cur[0] - pos.x, dy = cur[1] - pos.y;
            return dx === 1 ? 'ArrowRight' : dx === -1 ? 'ArrowLeft' : dy === 1 ? 'ArrowDown' : 'ArrowUp';
        }, { tx, ty });
        if (!dir) return false;
        await step(dir);
    }
    return false;
}

const findWorld = ch => page.evaluate(c => {
    const W = DBG.maps.WORLD;
    for (let y = 0; y < W.length; y++) { const x = W[y].indexOf(c); if (x >= 0) return { x, y }; }
    return null;
}, ch);

async function clickTown(label) {
    const b = page.locator('#townBtns button', { hasText: label }).first();
    if (!(await b.isVisible().catch(() => false))) return false;
    await b.click();
    await page.waitForTimeout(120);
    return true;
}

async function doTown(rest) {
    if (!(await vis('#town'))) return;
    stats.townVisits++;
    // talk until the villagers stop producing new dialogue
    for (let i = 0; i < 4; i++) {
        const before = seenDialog.size;
        if (!(await clickTown('與村民交談'))) break;
        await drainDialog();
        if (seenDialog.size === before) break;
    }
    // Rest before shopping: the inn costs gold too, and a bot that spends the lot
    // on potions can't afford a bed.
    if (rest) {
        if (await clickTown('客棧')) { stats.innRests++; await drainDialog(); }
    }
    if (await clickTown('商店')) {
        // Gear first — it's the bigger multiplier by far. 鏽劍 is +2 atk and 湛盧
        // is +30, so a well-equipped lv8 party beats bosses that a lv12 party
        // with starting kit loses to. Buy every upgrade offered, cheapest first
        // (the shop only offers one tier up per visit, gated by town tier).
        // Keep a float back for medicine — spending the purse to the last 兩 on
        // swords leaves you with no potions, which loses fights just as surely.
        // It has to scale: a flat 400 float means the opening 150兩 purse can
        // never clear it, so the bot buys NOTHING all game and you've measured
        // an unarmed party by accident.
        const floatFor = gold => Math.max(60, Math.min(400, Math.floor(gold * 0.25)));
        for (let pass = 0; pass < 6; pass++) {
            const gold = await page.evaluate(() => DBG.state().S.gold);
            const gear = page.locator('#shopItems button').filter({ hasText: /⚔️|🛡️/ });
            const n = await gear.count();
            let bought = false;
            for (let i = 0; i < n; i++) {
                const b = gear.nth(i);
                if (!(await b.isVisible().catch(() => false))) continue;
                if (await b.isDisabled().catch(() => false)) continue;   // can't afford
                const label = await b.innerText().catch(() => '');
                const cost = Number((label.match(/(\d+)\s*兩/) || [])[1] || 0);
                if (cost && gold - cost < floatFor(gold)) continue;       // leave medicine money
                await b.click().catch(() => {});
                stats.gearBought++;
                bought = true;
                await page.waitForTimeout(90);
                break;                       // the list re-renders after each buy
            }
            if (!bought) break;
        }
        // Then healing. Prefer 大還丹 (+150, stocked from tier 2): the tier-4
        // bosses hit for 52-66, so 金創藥 (+50) loses the race against them and
        // the bot bleeds out no matter how many it carries.
        for (const name of ['大還丹', '金創藥']) {
            for (let i = 0; i < 10; i++) {
                const p = page.locator('#shopItems button', { hasText: name }).first();
                if (!(await p.isVisible().catch(() => false))) break;
                if (await p.isDisabled().catch(() => false)) break;   // can't afford / not stocked
                await p.click().catch(() => {});
                stats.potionsBought++;
                await page.waitForTimeout(80);
                await drainDialog(5);
            }
        }
        const leave = page.locator('#shopLeave');
        if (await leave.isVisible().catch(() => false)) await leave.click().catch(() => {});
        await page.waitForTimeout(120);
    }
    await clickTown('離開村子');
    await page.waitForTimeout(150);
    await drainDialog();
}

async function clearDungeon(id) {
    const targets = await page.evaluate(i => {
        const m = DBG.maps.DMAPS[i], out = { chests: [], boss: null, door: null };
        m.forEach((row, y) => [...row].forEach((ch, x) => {
            if (ch === 'T') out.chests.push({ x, y });
            if (ch === 'B') out.boss = { x, y };
            if (ch === 'S') out.door = { x, y };
        }));
        return out;
    }, id);
    for (const c of targets.chests) { if (await walkTo(c.x, c.y)) stats.chests++; }
    if (targets.boss) {
        // the level you arrive at this boss with, having only fought what the
        // critical path walked you into — the whole "must you grind?" question
        const lv = await page.evaluate(() => DBG.state().S.party.map(h => h.lv).join('/'));
        stats.lvAtBoss[id] = lv;
        await walkTo(targets.boss.x, targets.boss.y);
    }
    await drainDialog();
    if (await vis('#battle')) await fight();
    await drainDialog();
    if ((await st()).mode === 'dungeon' && targets.door) await walkTo(targets.door.x, targets.door.y);
    await drainDialog();
}

async function goDungeon(worldChar, id, tries = 3) {
    for (let attempt = 1; attempt <= tries; attempt++) {
        // re-apply the buff: new party members join at the leader's level and
        // everyone takes chip damage on the way over
        if (BUFF) await page.evaluate(lv => DBG.buff(lv), BUFF);
        const p = await findWorld(worldChar);
        await walkTo(p.x, p.y);
        await drainDialog();
        const s = await st();
        if (s.mode !== 'dungeon') { log.push(`! failed to enter ${id} (mode=${s.mode})`); return false; }
        await clearDungeon(id);
        // a wipe boots us back to town with the boss still alive — try again
        const done = await page.evaluate(i => {
            const f = DBG.state().S.flags;
            return i === 'tomb' ? !!f.reforged : i === 'castle' ? !!f.malachorDown
                 : !!f.crystals[({ earth: 'earth', fire: 'fire', water: 'water' })[i]];
        }, id);
        if (done) return true;
        log.push(`  retrying ${id} (attempt ${attempt} did not clear it)`);
    }
    return false;
}

const objective = () => page.locator('#questText').innerText().catch(() => '');
async function mark(label) {
    const s = await st();
    log.push(`${label.padEnd(22)} lv${s.lv} party${s.party} ${stats.battles}btl ${stats.steps}steps | ${(await objective()).slice(0, 42)}`);
}

// ================= run =================
try {
    await page.goto('http://localhost:8765/xuanyuan/');
    await page.evaluate(() => localStorage.removeItem('xuanyuanSave'));
    await page.reload();
    await page.click('#btnNew');
    await drainDialog();
    if (BUFF) await page.evaluate(lv => DBG.buff(lv), BUFF);
    await mark('start');

    const t1 = await findWorld('1');
    await walkTo(t1.x, t1.y); await doTown(true); await mark('town1 桃源村');

    await goDungeon('A', 'earth'); await mark('earth 神農洞');

    const t2 = await findWorld('2');
    await walkTo(t2.x, t2.y); await doTown(true); await mark('town2 青丘寨');

    await goDungeon('B', 'fire'); await mark('fire 祝融火窟');

    const t3 = await findWorld('3');
    await walkTo(t3.x, t3.y); await doTown(true); await mark('town3 望川鎮');

    await goDungeon('C', 'water'); await mark('water 河伯水府');

    // the tomb and the castle are full dungeons with bosses, not just map events
    await goDungeon('J', 'tomb'); await mark('tomb 劍塚 (reforge)');

    await goDungeon('K', 'castle'); await drainDialog(400); await mark('castle 幽都之門');

    const ending = await vis('#ending') || (await objective()).includes('光明');
    log.push('ENDING REACHED: ' + ending);
} catch (e) {
    log.push('ABORTED: ' + e.message);
}

console.log(log.join('\n'));
console.log('\nSTATS ' + JSON.stringify(stats, null, 0));
console.log('unique dialogue screens: ' + seenDialog.size);
console.log('bot elapsed_s ' + ((Date.now() - t0) / 1000).toFixed(1));
if (errors.length) console.log('PAGE ERRORS', errors.slice(0, 5));
await browser.close();
