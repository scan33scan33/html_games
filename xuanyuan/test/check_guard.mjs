// The whole point of the palette guard is to catch a stray space. Prove it fires,
// and prove the clean sprites stay silent.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const warns = [];
page.on('console', m => { if (m.type() === 'warning') warns.push(m.text()); });
await page.goto('http://localhost:8765/xuanyuan/spritesheet.html');
await page.waitForTimeout(600);
let bad = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad++; };

// the real, clean sprite set must produce no warnings
check(warns.length === 0, `no warnings from the real sprite set${warns.length ? ': ' + warns.slice(0, 2) : ''}`);

// now deliberately register a grid with a stray space
await page.evaluate(() => {
    const rows = Array(16).fill('................');
    rows[3] = '.......k k......';   // stray space where a palette char should be
    SPR.add('__probe', rows);
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    SPR.blit(c.getContext('2d'), '__probe', 0, 0, 16);
});
await page.waitForTimeout(200);
check(warns.some(w => w.includes('__probe')), 'the guard warns on a stray space (the hole-punching bug it exists to catch)');

console.log(bad ? `\n${bad} check(s) failed` : '\nthe palette guard fires on bad input and stays silent on good');
await browser.close();
process.exit(bad ? 1 : 0);
