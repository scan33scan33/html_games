// The battle screen's feedback is CSS classes toggled from JS, and renderBattle()
// rebuilds the rows — so an effect applied before the re-render silently
// disappears. Sample every animation frame through a real round and assert the
// effects actually reach the screen.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 560, height: 620 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const vis = s => page.isVisible(s).catch(() => false);
async function drain(n = 40) {
    for (let i = 0; i < n; i++) {
        if (!(await vis('#dialog'))) return;
        await page.keyboard.press('Enter'); await page.waitForTimeout(50);
    }
}
let bad = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad++; };

await page.goto('http://localhost:8765/xuanyuan/');
await page.evaluate(() => localStorage.removeItem('xuanyuanSave'));
await page.reload();
await page.click('#btnNew');
await drain();
await page.evaluate(() => {
    DBG.buff(12); DBG.noEnc();
    S.party.push({ id: 'lyra', lv: 12, xp: 0, hp: 0, mp: 0, weapon: 0, armor: 0 });
    S.party.push({ id: 'zephyr', lv: 12, xp: 0, hp: 0, mp: 0, weapon: 0, armor: 0 });
    S.party.forEach(fullHeal);
    DBG.troop(['shanxiao', 'yaolang', 'fuyao']);
});
await page.waitForTimeout(400);
await drain();

// record peak fx across every frame — they last ~300ms and a poll would miss them
await page.evaluate(() => {
    window.__fx = { shake: 0, lunge: 0, lungeUp: 0, floats: new Set(), flash: 0, hitFlash: false };
    const tick = () => {
        const f = window.__fx;
        f.shake = Math.max(f.shake, document.querySelectorAll('.shake').length);
        f.lunge = Math.max(f.lunge, document.querySelectorAll('.lunge').length);
        f.lungeUp = Math.max(f.lungeUp, document.querySelectorAll('.lungeUp').length);
        document.querySelectorAll('.dmgFloat').forEach(d => f.floats.add(d.textContent));
        if (document.getElementById('flashFx').classList.contains('flashAnim')) f.flash++;
        // the struck sprite should white out — read the computed filter, since a
        // class landing on the card proves nothing about the img inside it
        document.querySelectorAll('.shake .pixspr').forEach(img => {
            const fl = getComputedStyle(img).filter;
            if (fl && fl !== 'none' && !/brightness\(1\)/.test(fl)) f.hitFlash = true;
        });
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
});

// one full round: every hero attacks, then the enemies take their turn
for (let i = 0; i < 3; i++) {
    const atk = page.locator('#cmds button', { hasText: '攻擊' }).first();
    if (!(await atk.isVisible().catch(() => false))) break;
    await atk.click();
    await page.waitForTimeout(60);
    await page.locator('#enemyRow .enemy:not(.dead)').first().click().catch(() => {});
    await page.waitForTimeout(80);
}
await page.waitForTimeout(2500);

const fx = await page.evaluate(() => ({
    shake: window.__fx.shake, lunge: window.__fx.lunge, lungeUp: window.__fx.lungeUp,
    floats: [...window.__fx.floats], flash: window.__fx.flash, hitFlash: window.__fx.hitFlash,
}));
check(fx.shake > 0, `the struck target shakes (peak ${fx.shake})`);
check(fx.hitFlash, 'the struck sprite whites out (computed filter on .shake .pixspr)');
check(fx.lungeUp > 0, `the attacking hero lunges (peak ${fx.lungeUp})`);
check(fx.floats.some(t => /^-\d+$/.test(t)), `damage numbers float: ${JSON.stringify(fx.floats.slice(0, 4))}`);

// A spell must tint the screen by element. Use a boss — the trash mobs die to
// the round above, the battle ends, and the check would silently skip.
await page.evaluate(() => {
    if (DBG.state().B) endBattle(true);
    S.party.forEach(fullHeal);
    DBG.boss('gonggong');            // 900hp: survives long enough to cast at
});
await page.waitForTimeout(500);
await drain();
const flashBefore = await page.evaluate(() => window.__fx.flash);
const spellBtn = page.locator('#cmds button', { hasText: '法術' }).first();
const canCast = await spellBtn.isVisible().catch(() => false);
check(canCast, 'the 法術 menu is reachable in a boss fight');
if (canCast) {
    await spellBtn.click(); await page.waitForTimeout(90);
    const first = page.locator('#cmds button').filter({ hasNotText: '返回' }).first();
    await first.click().catch(() => {});
    await page.waitForTimeout(90);
    const tgt = page.locator('#enemyRow .enemy:not(.dead)').first();
    if (await tgt.isVisible().catch(() => false)) await tgt.click().catch(() => {});
    // the other two heroes still need orders before the round resolves
    for (let i = 0; i < 2; i++) {
        const atk = page.locator('#cmds button', { hasText: '攻擊' }).first();
        if (!(await atk.isVisible().catch(() => false))) break;
        await atk.click(); await page.waitForTimeout(60);
        await page.locator('#enemyRow .enemy:not(.dead)').first().click().catch(() => {});
        await page.waitForTimeout(80);
    }
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => window.__fx.flash);
    check(after > flashBefore, `casting flashes the screen (${flashBefore} -> ${after})`);
    const lunge = await page.evaluate(() => window.__fx.lunge);
    check(lunge > 0, `the boss lunges on its turn (peak ${lunge})`);
}

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); bad++; }
console.log(bad ? `\n${bad} check(s) failed` : '\nbattle effects reach the screen');
await browser.close();
process.exit(bad ? 1 : 0);
