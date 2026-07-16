// The battle screen is single-frame sprites, so without an idle animation
// nothing on it moves until something is hit. Check the monsters actually
// breathe, that the row is staggered (three sprites bobbing in unison looks
// worse than none), and that corpses stop.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 560, height: 620 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const vis = s => page.isVisible(s).catch(() => false);
let bad = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad++; };

await page.goto('http://localhost:8765/xuanyuan/');
await page.evaluate(() => localStorage.removeItem('xuanyuanSave'));
await page.reload();
await page.click('#btnNew');
for (let i = 0; i < 40; i++) { if (!(await vis('#dialog'))) break; await page.keyboard.press('Enter'); await page.waitForTimeout(50); }
await page.evaluate(() => {
    DBG.buff(12); DBG.noEnc();
    S.party.push({ id: 'lyra', lv: 12, xp: 0, hp: 0, mp: 0, weapon: 0, armor: 0 });
    S.party.forEach(fullHeal);
    DBG.troop(['shanxiao', 'yaolang', 'fuyao']);
});
await page.waitForTimeout(400);
for (let i = 0; i < 20; i++) { if (!(await vis('#dialog'))) break; await page.keyboard.press('Enter'); await page.waitForTimeout(50); }

// sample the first sprite's transform over time — it should not sit still
const moved = await page.evaluate(async () => {
    const img = document.querySelector('#enemyRow .enemy .pixspr');
    const seen = new Set();
    for (let i = 0; i < 24; i++) {
        seen.add(getComputedStyle(img).transform);
        await new Promise(r => setTimeout(r, 60));
    }
    return seen.size;
});
check(moved > 2, `the monster sprite is moving (${moved} distinct transforms sampled)`);

// the row must be staggered, or it reads as a pulse rather than breathing
const delays = await page.evaluate(() =>
    [...document.querySelectorAll('#enemyRow .enemy .pixspr')]
        .map(i => getComputedStyle(i).animationDelay));
check(new Set(delays).size > 1, `the row is staggered: ${JSON.stringify(delays)}`);

// EVERY enemy must still flash when hit, not just the first. The stagger uses
// .enemy:nth-child(n) (0-3-0), which out-specifies `.shake .pixspr` (0-2-0) — so
// a -0.9s idle delay can land on the 0.28s flash and silently kill it for
// monsters 2 and 3. Testing only the first enemy misses that completely.
const flashPerSlot = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#enemyRow .enemy').forEach((el, i) => {
        el.classList.add('shake');
        const cs = getComputedStyle(el.querySelector('.pixspr'));
        out.push({ i, name: cs.animationName, delay: cs.animationDelay });
        el.classList.remove('shake');
    });
    return out;
});
for (const s of flashPerSlot) {
    check(s.name === 'hitFlashA' && parseFloat(s.delay) === 0,
        `enemy ${s.i} flashes when hit (animation ${s.name}, delay ${s.delay})`);
}

// a corpse should stop breathing
const deadStops = await page.evaluate(() => {
    const e = DBG.state().B.enemies[0];
    e.hp = 0;
    renderBattle();
    const img = document.querySelector('#enemyRow .enemy.dead .pixspr');
    return img ? getComputedStyle(img).animationName : 'no-dead-sprite';
});
check(deadStops === 'none', `the dead stop breathing (animation-name: ${deadStops})`);

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); bad++; }
console.log(bad ? `\n${bad} check(s) failed` : '\nthe battle screen is alive between hits');
await browser.close();
process.exit(bad ? 1 : 0);
