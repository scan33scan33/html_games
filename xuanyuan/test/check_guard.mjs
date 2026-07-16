// The whole point of the palette guard is to catch a stray space. Prove it fires,
// and prove the clean sprites stay silent.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const warns = [];
page.on('console', m => { if (m.type() === 'warning') warns.push(m.text()); });
await page.goto('http://localhost:8765/xuanyuan/spritesheet.html');
await page.waitForTimeout(600);
console.log('warnings from the real sprite set:', warns.length ? warns : 'none (good)');

// now deliberately register a grid with a stray space
const fired = await page.evaluate(() => {
    const rows = Array(16).fill('................');
    rows[3] = '.......k k......';   // stray space where a palette char should be
    SPR.add('__probe', rows);
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    SPR.blit(c.getContext('2d'), '__probe', 0, 0, 16);
    return true;
});
await page.waitForTimeout(200);
const hit = warns.find(w => w.includes('__probe'));
console.log('guard fired on a stray space:', hit ? 'YES -> ' + hit : 'NO — guard is broken');
await browser.close();
