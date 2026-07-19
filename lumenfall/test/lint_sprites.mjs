import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:8765/lumenfall/');
await p.waitForTimeout(300);
const r = await p.evaluate(() => {
  const pal = new Set(Object.keys(SPR.palette()));
  const bad = [];
  for (const name of SPR.list()) {
    SPR.grids(name).forEach((rows, f) => {
      if (rows.length !== 16) bad.push(`${name} frame ${f}: ${rows.length} rows`);
      const w = [...new Set(rows.map(x => x.length))];
      if (w.length !== 1 || w[0] !== 16) bad.push(`${name} frame ${f}: widths ${w}`);
      const unk = new Set();
      rows.forEach(row => [...row].forEach(c => { if (!pal.has(c)) unk.add(c); }));
      if (unk.size) bad.push(`${name} frame ${f}: unknown ${[...unk]}`);
    });
  }
  return { count: SPR.list().length, bad };
});
console.log(r.bad.length ? r.bad.join('\n') : `all ${r.count} sprites: 16x16, palette-clean`);
await b.close();
process.exit(r.bad.length ? 1 : 0);
