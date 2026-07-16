// Verify the claim: a party wipe shows no game-over screen, it respawns you at
// 桃源村 with half your gold.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 520, height: 460 } });
const vis = s => page.isVisible(s).catch(() => false);
async function drain(n = 40) {
    for (let i = 0; i < n; i++) {
        if (!(await vis('#dialog'))) return;
        await page.keyboard.press('Enter');
        await page.waitForTimeout(60);
    }
}
await page.goto('http://localhost:8765/xuanyuan/');
await page.evaluate(() => localStorage.removeItem('xuanyuanSave'));
await page.reload();
await page.click('#btnNew');
await drain();
await page.evaluate(() => { DBG.noEnc(); DBG.gold(1000); });
const before = await page.evaluate(() => ({ gold: DBG.state().S.gold, x: DBG.state().S.x, y: DBG.state().S.y }));

// start a boss fight and kill our own party
await page.evaluate(() => DBG.boss('tubo'));
await page.waitForTimeout(300);
await drain();
await page.evaluate(() => { S.party.forEach(h => { h.hp = 0; }); });
// take a turn so the game notices
for (let i = 0; i < 12; i++) {
    const atk = page.locator('#cmds button', { hasText: '攻擊' }).first();
    if (await atk.isVisible().catch(() => false)) {
        await atk.click().catch(() => {});
        await page.waitForTimeout(60);
        await page.locator('#enemyRow .enemy:not(.dead)').first().click().catch(() => {});
    }
    await page.waitForTimeout(250);
    if (await vis('#dialog')) break;
}
let bad = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad++; };

const dlg = await page.locator('#dialogBox').innerText().catch(() => '(none)');
check(dlg.includes('隊伍全滅'), `a wipe announces itself: ${JSON.stringify(dlg.split('\n')[0])}`);
check(!(await vis('#title')), 'no game over — the title screen is NOT shown');
await drain();
const after = await page.evaluate(() => {
    const s = DBG.state();
    const t1 = (() => { const W = DBG.maps.WORLD; for (let y = 0; y < W.length; y++) { const x = W[y].indexOf('1'); if (x >= 0) return { x, y }; } })();
    return { gold: s.S.gold, x: s.S.x, y: s.S.y, mode: s.mode, town1: t1,
             alive: s.S.party.every(h => h.hp > 0) };
});
check(after.gold === Math.floor(before.gold / 2), `half the gold is taken: ${before.gold} -> ${after.gold}`);
check(after.mode === 'world', `back on the world map (mode: ${after.mode})`);
check(after.town1 && after.x === after.town1.x && after.y === after.town1.y + 1,
    `respawned at 桃源村: ${JSON.stringify({ x: after.x, y: after.y })} vs town ${JSON.stringify(after.town1)}`);
check(after.alive, 'the party is revived, not left at 0hp');

console.log(bad ? `\n${bad} check(s) failed` : '\na wipe costs half your gold and sends you home — it is not a game over');
await browser.close();
process.exit(bad ? 1 : 0);
