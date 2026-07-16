// The finale is two-phase: beating 玄淵 must hand off to 噬魂・借體 wearing his
// body, and only beating THAT reaches the ending. Prove both phases fire — the
// handoff runs through a dialogue callback, which is easy to break silently.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 520, height: 460 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));

const vis = s => page.isVisible(s).catch(() => false);
const seen = [];
async function drain(n = 80) {
    for (let i = 0; i < n; i++) {
        if (!(await vis('#dialog'))) return;
        await page.keyboard.press('Enter');
        await page.waitForTimeout(50);
    }
}
// record which boss is on screen whenever a battle is up
async function noteEnemy() {
    const name = await page.evaluate(() => {
        const s = DBG.state();
        return s.B && s.B.enemies[0] ? s.B.enemies[0].id : null;
    }).catch(() => null);
    if (name && seen[seen.length - 1] !== name) seen.push(name);
}
async function fight(cap = 200) {
    for (let t = 0; t < cap; t++) {
        if (!(await vis('#battle'))) return true;
        await noteEnemy();
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

await page.goto('http://localhost:8765/xuanyuan/');
await page.evaluate(() => localStorage.removeItem('xuanyuanSave'));
await page.reload();
await page.click('#btnNew');
await drain();

// set up the finale state: crystals + reforged sword, then walk into 幽都之門
await page.evaluate(() => {
    DBG.buff(22); DBG.noEnc();
    S.party.push({ id: 'lyra', lv: 22, xp: 0, hp: 0, mp: 0, weapon: 0, armor: 0 });
    S.party.push({ id: 'zephyr', lv: 22, xp: 0, hp: 0, mp: 0, weapon: 0, armor: 0 });
    S.flags.crystals = { earth: true, fire: true, water: true };
    S.flags.reforged = true;
    S.party[0].weapon = WEAPONS.auron.length - 1;
    S.party.forEach(fullHeal);
    S.inv.jinchuang = 40;
});
const K = await page.evaluate(() => {
    const W = DBG.maps.WORLD;
    for (let y = 0; y < W.length; y++) { const x = W[y].indexOf('K'); if (x >= 0) return { x, y }; }
});
await page.evaluate(({ x, y }) => DBG.tp(x, y + 1), K);
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(400);
await drain();
console.log('entered 幽都之門:', await page.evaluate(() => DBG.state().mode === 'dungeon'));

// walk to the boss tile
const boss = await page.evaluate(() => {
    const m = DBG.maps.DMAPS.castle;
    for (let y = 0; y < m.length; y++) { const x = m[y].indexOf('B'); if (x >= 0) return { x, y }; }
});
await page.evaluate(({ x, y }) => DBG.tp(x, y), boss);
await page.evaluate(() => { const p = DBG.state().S.dpos; enterTile('B', p.x, p.y); });
await page.waitForTimeout(300);
await drain();

// phase 1, then the handoff, then phase 2
await fight();
await drain();
if (await vis('#battle')) { await noteEnemy(); await fight(); await drain(); }
await drain(120);

const end = await page.evaluate(() => ({
    ending: !!document.getElementById('ending').classList.contains('open'),
    malachorDown: !!DBG.state().S.flags.malachorDown,
    mode: DBG.state().mode,
    track: DBG.track(),
}));
console.log('bosses fought, in order:', seen.join(' -> '));
const twoPhase = seen.includes('xuanyuan_w') && seen.includes('shihun');
console.log(twoPhase ? 'ok   two-phase finale fired (玄淵 -> 噬魂・借體)'
                     : 'FAIL expected xuanyuan_w then shihun, got: ' + seen.join(','));
console.log(end.ending ? 'ok   ending overlay shown' : 'FAIL ending overlay not shown');
console.log(end.malachorDown ? 'ok   malachorDown flag set' : 'FAIL malachorDown not set');
console.log('ending track:', end.track, end.track === 'ending' ? '(ok)' : '(FAIL — expected "ending")');
if (errors.length) console.log('PAGE ERRORS:', errors.slice(0, 3));
await browser.close();
process.exit(twoPhase && end.ending && end.malachorDown && end.track === 'ending' && !errors.length ? 0 : 1);
