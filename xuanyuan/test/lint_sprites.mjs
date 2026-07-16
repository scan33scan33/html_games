// Lint every sprite grid: 16x16, and every char present in PALETTE.
// Reads the sprites through SPR in a real browser rather than regexing the
// source — the source has nested frame arrays now, and a regex reads those
// (and the engine's own methods) as sprites.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
page.on('pageerror', e => { console.log('PAGEERROR', e.message); });
await page.goto('http://localhost:8765/xuanyuan/spritesheet.html');

const report = await page.evaluate(() => {
    const pal = SPR.palette();
    const known = new Set(Object.keys(pal));
    return SPR.list().map(name => {
        const frames = SPR.grids(name);
        const bad = [];
        frames.forEach((rows, f) => {
            if (rows.length !== 16) bad.push(`frame ${f}: ${rows.length} rows`);
            const widths = [...new Set(rows.map(r => r.length))];
            if (widths.length !== 1 || widths[0] !== 16) bad.push(`frame ${f}: widths ${widths}`);
            const unknown = new Set();
            rows.forEach(r => [...r].forEach(c => { if (!known.has(c)) unknown.add(c); }));
            if (unknown.size) bad.push(`frame ${f}: unknown ${JSON.stringify([...unknown])}`);
        });
        return { name, frames: frames.length, bad };
    });
});

let bad = 0;
const animated = [];
for (const s of report) {
    if (s.bad.length) { bad++; console.log('FAIL', s.name, '-', s.bad.join('; ')); }
    if (s.frames > 1) animated.push(`${s.name}×${s.frames}`);
}
console.log(`${report.length} sprites checked, ${report.reduce((n, s) => n + s.frames, 0)} frames total`);
if (animated.length) console.log('animated:', animated.join(' '));
console.log(bad ? `\n${bad} malformed` : '\nall grids 16x16, palette clean');
await browser.close();
process.exit(bad ? 1 : 0);
