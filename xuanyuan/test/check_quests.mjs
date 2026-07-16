// The two side quests (妖巢 rescue, 商隊 rescue) sit off the critical path, so a
// playthrough bot never touches them. Each is a chain: event -> battle ->
// questReward -> report back to an NPC for the payout. Walk both ends of it.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 520, height: 460 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const vis = s => page.isVisible(s).catch(() => false);

async function drain(n = 80) {
    for (let i = 0; i < n; i++) {
        if (!(await vis('#dialog'))) return;
        await page.keyboard.press('Enter');
        await page.waitForTimeout(50);
    }
}
async function fight(cap = 150) {
    for (let t = 0; t < cap; t++) {
        if (!(await vis('#battle'))) return true;
        if (await vis('#dialog')) { await drain(20); continue; }
        const atk = page.locator('#cmds button', { hasText: '攻擊' }).first();
        if (await atk.isVisible().catch(() => false)) {
            await atk.click().catch(() => {});
            await page.waitForTimeout(50);
            await page.locator('#enemyRow .enemy:not(.dead)').first().click().catch(() => {});
        }
        await page.waitForTimeout(140);
    }
    return false;
}
const findWorld = ch => page.evaluate(c => {
    const W = DBG.maps.WORLD;
    for (let y = 0; y < W.length; y++) { const x = W[y].indexOf(c); if (x >= 0) return { x, y }; }
    return null;
}, ch);
// step onto a world tile for real (these events fire on the step, not on arrival)
async function stepOnto(p) {
    await page.evaluate(({ x, y }) => DBG.tp(x, y + 1), p);
    await page.waitForTimeout(120);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(350);
}

await page.goto('http://localhost:8765/xuanyuan/');
await page.evaluate(() => localStorage.removeItem('xuanyuanSave'));
await page.reload();
await page.click('#btnNew');
await drain();
await page.evaluate(() => {
    DBG.buff(22); DBG.noEnc();
    S.party.push({ id: 'lyra', lv: 22, xp: 0, hp: 0, mp: 0, weapon: 0, armor: 0 });
    // must match the flag, not just the roster: townTalk(1) branches on
    // recruited.lyra first, so without this the 村長 re-recruits her and the
    // quest-reward branch is never reached
    S.flags.recruited.lyra = true;
    S.party.forEach(fullHeal);
    S.inv.jinchuang = 40;
});

let bad = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad++; };

// ---- 妖巢: rescue the child, then report to the 村長 for the reward ----
await stepOnto(await findWorld('n'));
await drain();
await fight();
await drain();
const nestQ = await page.evaluate(() => DBG.state().S.flags.quests.nest);
check(nestQ === 1, `妖巢 cleared -> quests.nest = ${nestQ} (expect 1: child rescued, not yet reported)`);

const goldBefore = await page.evaluate(() => DBG.state().S.gold);
await stepOnto(await findWorld('1'));
await page.waitForTimeout(200);
if (await vis('#town')) {
    await page.locator('#townBtns button', { hasText: '與村民交談' }).first().click().catch(() => {});
    await page.waitForTimeout(150);
    await drain();
}
const after = await page.evaluate(() => ({
    q: DBG.state().S.flags.quests.nest, gold: DBG.state().S.gold,
    neidan: DBG.state().S.inv.neidan || 0,
}));
check(after.q === 2, `reported to 村長 -> quests.nest = ${after.q} (expect 2)`);
check(after.gold > goldBefore, `reward paid: ${goldBefore} -> ${after.gold} 兩`);
check(after.neidan >= 1, `內丹 received: ${after.neidan}`);

// re-entering the nest should not re-run the quest
await page.evaluate(() => leaveTown());
await page.waitForTimeout(150);
await stepOnto(await findWorld('n'));
await drain();
const replay = await page.evaluate(() => ({ q: DBG.state().S.flags.quests.nest, inBattle: !!DBG.state().B }));
check(replay.q === 2 && !replay.inBattle, 're-entering 妖巢 does not replay the quest');

// ---- 商隊: the desert caravan ----
await page.evaluate(() => { S.party.forEach(fullHeal); S.inv.jinchuang = 40; });
await stepOnto(await findWorld('x'));
await drain();
await fight();
await drain();
const car = await page.evaluate(() => DBG.state().S.flags.quests.caravan);
check(car >= 1, `商隊 rescued -> quests.caravan = ${car} (expect >=1)`);

// ---- the 大還丹 hint: the only place the game admits the late game is an
// inventory gate. Must fire on three crystals, and not before. ----
async function boatmanSays() {
    const out = [];
    await page.evaluate(() => openTown(3));
    await page.waitForTimeout(150);
    await page.locator('#townBtns button', { hasText: '與村民交談' }).first().click().catch(() => {});
    await page.waitForTimeout(150);
    for (let i = 0; i < 30; i++) {
        if (!(await vis('#dialog'))) break;
        out.push(await page.locator('#dialogBox').innerText().catch(() => ''));
        await page.keyboard.press('Enter');
        await page.waitForTimeout(55);
    }
    await page.evaluate(() => { if (DBG.state().mode === 'town') leaveTown(); });
    await page.waitForTimeout(120);
    return out.join('\n');
}
await page.evaluate(() => { S.flags.crystals = { earth: true, fire: true }; });
check(!(await boatmanSays()).includes('大還丹'), '大還丹 hint stays quiet at 2 crystals');
await page.evaluate(() => { S.flags.crystals = { earth: true, fire: true, water: true }; });
check((await boatmanSays()).includes('大還丹'), '大還丹 hint fires once all 3 crystals are in hand');

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); bad++; }
console.log(bad ? `\n${bad} check(s) failed` : '\nboth side quests complete end to end');
await browser.close();
process.exit(bad ? 1 : 0);
