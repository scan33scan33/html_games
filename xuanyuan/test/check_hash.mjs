// th(x,y,n) drives tile variants and mirroring. A skewed hash doesn't crash — it
// silently makes the variation stop happening, which is invisible unless you
// measure it. (The original overflowed 2^53 and returned <0.5 for every tile.)
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('http://localhost:8765/xuanyuan/');

const r = await page.evaluate(() => {
    const N = 40, M = 32;
    const buckets = Array(10).fill(0);
    const counts = { tree2: 0, peak2: 0, flip: 0, total: 0 };
    for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) {
        counts.total++;
        if (th(x, y, 7) < 0.42) counts.tree2++;
        if (th(x, y, 7) < 0.38) counts.peak2++;
        if (th(x, y, 3) < 0.5) counts.flip++;
        buckets[Math.min(9, Math.floor(th(x, y, 1) * 10))]++;
    }
    return { buckets, counts };
});

const pct = (a, b) => (a / b) * 100;
const rows = [
    ['tree2 variant', pct(r.counts.tree2, r.counts.total), 42],
    ['peak2 variant', pct(r.counts.peak2, r.counts.total), 38],
    ['mirrored', pct(r.counts.flip, r.counts.total), 50],
];
let bad = 0;
for (const [label, got, want] of rows) {
    const ok = Math.abs(got - want) <= 8;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(14)} ${got.toFixed(1)}% (expect ~${want}% ±8)`);
}
// a uniform hash should fill all ten deciles
const expect = r.counts.total / 10;
const worst = Math.max(...r.buckets.map(b => Math.abs(b - expect) / expect));
const uOk = worst < 0.4;
if (!uOk) bad++;
console.log(`${uOk ? 'ok  ' : 'FAIL'} uniformity    deciles ${r.buckets.join(' ')} (each ~${expect}, worst dev ${(worst * 100).toFixed(0)}%)`);
console.log(bad ? `\n${bad} check(s) failed — th() is skewed` : '\nth() is uniform');
await browser.close();
process.exit(bad ? 1 : 0);
