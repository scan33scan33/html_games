// The difficulty curve is gated on gear, and nothing used to say so. 墨璃's shop
// hint is that signpost — it must appear exactly when it's actionable (you can
// afford an upgrade) and shut up when it isn't, or it's just noise.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 520, height: 460 } });
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
const hint = () => page.locator('#shopHint').innerText().catch(() => '');
const openShopAt = tier => page.evaluate(t => { $('town').classList.remove('open'); openShop(t); }, tier);

await page.goto('http://localhost:8765/xuanyuan/');
await page.evaluate(() => localStorage.removeItem('xuanyuanSave'));
await page.reload();
await page.click('#btnNew');
await drain();
await page.evaluate(() => DBG.noEnc());

// 1. before 墨璃 joins, she has nothing to say
await page.evaluate(() => DBG.gold(9999));
await openShopAt(1);
await page.waitForTimeout(150);
check((await hint()).length === 0, 'silent before 墨璃 joins the party');

// 2. with her along, flush, and a rusty sword -> the strong nudge
await page.evaluate(() => {
    S.flags.recruited.lyra = true;
    S.party.push({ id: 'lyra', lv: 1, xp: 0, hp: 0, mp: 0, weapon: 0, armor: 0 });
    S.party.forEach(fullHeal);
    DBG.gold(9999);
});
await openShopAt(1);
await page.waitForTimeout(150);
const rusty = await hint();
check(rusty.includes('鏽劍'), 'calls out the starting sword while you still carry it');
check(rusty.includes('一把好劍抵得上苦練十年'), 'states the actual rule: gear beats levels');

// 3. broke -> silent (nagging about what you can't buy is noise)
await page.evaluate(() => DBG.gold(0));
await openShopAt(1);
await page.waitForTimeout(150);
check((await hint()).length === 0, 'silent when you cannot afford anything');

// 4. upgraded past the rusty sword but still able to buy -> the softer nudge
await page.evaluate(() => { S.party.forEach(h => { h.weapon = 1; h.armor = 1; }); DBG.gold(9999); });
await openShopAt(2);
await page.waitForTimeout(150);
const soft = await hint();
check(soft.length > 0 && !soft.includes('鏽劍'), 'switches to the softer nudge once re-armed');

// 5. fully kitted at this tier -> silent
await page.evaluate(() => {
    S.party.forEach(h => { h.weapon = Math.min(2, WEAPONS[h.id].length - 1); h.armor = 2; });
    DBG.gold(9999);
});
await openShopAt(2);
await page.waitForTimeout(150);
check((await hint()).length === 0, 'silent when nothing is left to buy at this tier');

// 6. the hint must not squash to nothing, and must not push the title out of
// view: the overlay is a column flex box that overflows, which both hides a
// flex-shrinkable child and clips the top under plain `justify-content: center`.
await page.evaluate(() => {
    S.party.forEach(h => { h.weapon = 0; h.armor = 0; });
    DBG.gold(9999);
});
await openShopAt(1);
await page.waitForTimeout(200);
const box = await page.evaluate(() => {
    const el = document.getElementById('shopHint');
    const shop = document.getElementById('shop');
    const h2 = document.getElementById('shopTitle');
    const r = el.getBoundingClientRect(), sr = shop.getBoundingClientRect(), hr = h2.getBoundingClientRect();
    return { h: Math.round(r.height), titleClipped: hr.top < sr.top };
});
check(box.h > 10, `hint has real height, not squashed by flex (${box.h}px)`);
check(!box.titleClipped, 'the shop title is still on screen with the hint present');

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); bad++; }
console.log(bad ? `\n${bad} check(s) failed` : '\nthe shop hint speaks only when it is actionable');
await browser.close();
process.exit(bad ? 1 : 0);
