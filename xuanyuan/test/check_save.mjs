// Saves are the one thing a player can permanently lose. localStorage survives
// reloads, so a save written by an older build gets loaded by a newer one —
// check the round-trip, and that a save missing newer fields still loads.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 520, height: 460 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const vis = s => page.isVisible(s).catch(() => false);
async function drain(n = 60) {
    for (let i = 0; i < n; i++) {
        if (!(await vis('#dialog'))) return;
        await page.keyboard.press('Enter');
        await page.waitForTimeout(50);
    }
}
let bad = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad++; };

await page.goto('http://localhost:8765/xuanyuan/');
await page.evaluate(() => localStorage.removeItem('xuanyuanSave'));
await page.reload();
await page.click('#btnNew');
await drain();

// build a distinctive state and save it
await page.evaluate(() => {
    DBG.buff(9); DBG.noEnc(); DBG.gold(4321);
    S.party.push({ id: 'lyra', lv: 9, xp: 0, hp: 0, mp: 0, weapon: 0, armor: 0 });
    S.flags.recruited.lyra = true;
    S.flags.crystals = { earth: true, fire: true };
    S.flags.quests.nest = 2;
    S.hu.shanxiao = 3;
    S.x = 12; S.y = 15;
    S.party.forEach(fullHeal);
    save();
});
const before = await page.evaluate(() => {
    const s = DBG.state().S;
    return { gold: s.gold, party: s.party.length, lv: s.party[0].lv, x: s.x, y: s.y,
             crystals: Object.keys(s.flags.crystals).sort().join(','), nest: s.flags.quests.nest,
             hu: s.hu.shanxiao };
});

// reload the page and continue
await page.reload();
await page.waitForTimeout(300);
check(!(await page.locator('#btnContinue').isDisabled()), '繼續 button enabled after a save exists');
await page.click('#btnContinue');
await page.waitForTimeout(300);
await drain();
const after = await page.evaluate(() => {
    const s = DBG.state().S;
    return { gold: s.gold, party: s.party.length, lv: s.party[0].lv, x: s.x, y: s.y,
             crystals: Object.keys(s.flags.crystals).sort().join(','), nest: s.flags.quests.nest,
             hu: s.hu.shanxiao };
});
for (const k of Object.keys(before)) {
    check(String(before[k]) === String(after[k]), `${k} survives reload: ${before[k]} -> ${after[k]}`);
}

// a save from before 煉妖壺/quests existed must still load (load() backfills)
await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('xuanyuanSave'));
    delete raw.hu;
    delete raw.flags.quests;
    localStorage.setItem('xuanyuanSave', JSON.stringify(raw));
});
await page.reload();
await page.waitForTimeout(300);
await page.click('#btnContinue');
await page.waitForTimeout(300);
await drain();
const legacy = await page.evaluate(() => {
    const s = DBG.state().S;
    return { loaded: !!s, hu: JSON.stringify(s.hu), quests: JSON.stringify(s.flags.quests), gold: s.gold };
});
check(legacy.loaded && legacy.gold === 4321, `legacy save (no hu/quests) still loads: gold=${legacy.gold}`);
check(legacy.hu === '{}', `missing hu backfilled: ${legacy.hu}`);
check(legacy.quests && legacy.quests !== 'undefined', `missing quests backfilled: ${legacy.quests}`);

// a corrupt save must not brick the title screen
await page.evaluate(() => localStorage.setItem('xuanyuanSave', '{not json'));
await page.reload();
await page.waitForTimeout(300);
check(await vis('#title'), 'corrupt save still shows the title screen');
check(await page.locator('#btnContinue').isDisabled(), '繼續 disabled for a corrupt save');

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); bad++; }
console.log(bad ? `\n${bad} check(s) failed` : '\nsave/load round-trips cleanly');
await browser.close();
process.exit(bad ? 1 : 0);
