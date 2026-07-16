// A player who walks out of 桃源村 with the starting sword faces roughly a
// 1-in-7 fight at 土伯 (report_fights.mjs) and can't know why. 墨璃 warns at the
// dungeon door — once, only while it's true, and it must survive a save/reload
// (the flag lives in S.flags, which is what gets serialised).
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 520, height: 460 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const vis = s => page.isVisible(s).catch(() => false);
let bad = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad++; };

// read every dialogue screen, then leave the dungeon again
async function enterAndRead() {
    const A = await page.evaluate(() => {
        const W = DBG.maps.WORLD;
        for (let y = 0; y < W.length; y++) { const x = W[y].indexOf('A'); if (x >= 0) return { x, y }; }
    });
    await page.evaluate(({ x, y }) => DBG.tp(x, y + 1), A);
    await page.waitForTimeout(120);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(350);
    const seen = [];
    for (let i = 0; i < 30; i++) {
        if (!(await vis('#dialog'))) break;
        seen.push(await page.locator('#dialogBox').innerText().catch(() => ''));
        await page.keyboard.press('Enter');
        await page.waitForTimeout(60);
    }
    await page.evaluate(() => { if (DBG.state().mode === 'dungeon') exitDungeon(''); });
    await page.waitForTimeout(150);
    for (let i = 0; i < 10; i++) {
        if (!(await vis('#dialog'))) break;
        await page.keyboard.press('Enter'); await page.waitForTimeout(50);
    }
    return seen.join('\n');
}

await page.goto('http://localhost:8765/xuanyuan/');
await page.evaluate(() => localStorage.removeItem('xuanyuanSave'));
await page.reload();
await page.click('#btnNew');
for (let i = 0; i < 40; i++) { if (!(await vis('#dialog'))) break; await page.keyboard.press('Enter'); await page.waitForTimeout(50); }
await page.evaluate(() => {
    DBG.noEnc(); DBG.buff(6);
    S.flags.recruited.lyra = true;
    S.party.push({ id: 'lyra', lv: 6, xp: 0, hp: 0, mp: 0, weapon: 0, armor: 0 });
    S.party.forEach(fullHeal);
    // Persist the setup NOW. Otherwise the reload in check 3 restores the save
    // written by startNew() — which predates 墨璃 joining — and the warning then
    // stays silent because she isn't in the party, not because the flag stuck.
    // That passes the check for entirely the wrong reason.
    save();
});

// 1. carrying the starting sword -> warned
check((await enterAndRead()).includes('先回鎮上換兵器'), 'warns at the door while still on the starting weapon');

// 2. it is a one-time thing, not a nag
check(!(await enterAndRead()).includes('先回鎮上換兵器'), 'does not repeat on the next dungeon entry');

// 3. The flag must survive a reload — WITHOUT us calling save() by hand. The
// game has to persist it itself at the moment it warns; calling save() here
// would only prove the flag serialises, which is not the thing that matters.
await page.reload();
await page.waitForTimeout(300);
await page.click('#btnContinue');
await page.waitForTimeout(300);
for (let i = 0; i < 20; i++) { if (!(await vis('#dialog'))) break; await page.keyboard.press('Enter'); await page.waitForTimeout(50); }
await page.evaluate(() => DBG.noEnc());
check(!(await enterAndRead()).includes('先回鎮上換兵器'), 'stays quiet after a save/reload (flag is persisted)');

// 4. a properly armed party is never warned at all
await page.evaluate(() => {
    localStorage.removeItem('xuanyuanSave');
});
await page.reload();
await page.waitForTimeout(200);
await page.click('#btnNew');
for (let i = 0; i < 40; i++) { if (!(await vis('#dialog'))) break; await page.keyboard.press('Enter'); await page.waitForTimeout(50); }
await page.evaluate(() => {
    DBG.noEnc(); DBG.buff(6);
    S.flags.recruited.lyra = true;
    S.party.push({ id: 'lyra', lv: 6, xp: 0, hp: 0, mp: 0, weapon: 1, armor: 1 });
    S.party.forEach(h => { h.weapon = 1; h.armor = 1; });
    S.party.forEach(fullHeal);
});
check(!(await enterAndRead()).includes('先回鎮上換兵器'), 'silent for a party that has actually re-armed');

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); bad++; }
console.log(bad ? `\n${bad} check(s) failed` : '\nthe door warning fires once, only when it is true');
await browser.close();
process.exit(bad ? 1 : 0);
