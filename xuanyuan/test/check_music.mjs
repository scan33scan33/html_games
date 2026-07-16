// Verify every track is well-formed, in-scale, and actually gets selected in game.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:8765/xuanyuan/');

// pull TRACKS out of the page by re-reading the source it was defined from
const report = await page.evaluate(async () => {
    const src = await (await fetch('index.html')).text();
    const body = src.match(/const TRACKS = \{([\s\S]*?)\n    \};/)[1];
    // eslint-disable-next-line no-new-func
    const TRACKS = new Function('return {' + body + '}')();
    // 宮商角徵羽 is a *shape*, not a fixed set of notes — it transposes. A track
    // in 羽 mode on D (D F G A C) is just as pentatonic as one on C; checking
    // against C only would wrongly flag it. So test the pitch-class set against
    // every transposition and report the tonics that fit.
    const PENTA = [0, 2, 4, 7, 9];
    const out = [];
    for (const [name, t] of Object.entries(TRACKS)) {
        const notes = t.lead.flat().filter(n => n > 0);
        const pcs = [...new Set(notes.map(n => ((n % 12) + 12) % 12))];
        const fits = [];
        for (let root = 0; root < 12; root++) {
            const set = PENTA.map(p => (p + root) % 12);
            if (pcs.every(p => set.includes(p))) fits.push(root);
        }
        const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const offScale = fits.length ? [] : pcs;
        out.push({
            name,
            bars: t.lead.length,
            stepsPerBar: [...new Set(t.lead.map(b => b.length))],
            bassBars: t.bass.length,
            chordBars: t.chords.length,
            drumLen: t.drums.length,
            notes: notes.length,
            range: notes.length ? [Math.min(...notes), Math.max(...notes)] : null,
            offScale,
            collection: fits.map(r => NAMES[r]).join('/') || '(none)',
        });
    }
    return out;
});

let bad = 0;
for (const t of report) {
    const ok = t.bars === 8 && t.stepsPerBar.length === 1 && t.stepsPerBar[0] === 8 &&
               t.bassBars === 8 && t.chordBars === 8 && t.drumLen === 8 && !t.offScale.length;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${t.name.padEnd(10)} bars=${t.bars} notes=${String(t.notes).padStart(3)} ` +
        `range=${String(t.range).padEnd(7)} pentatonic-on: ${t.collection} ` +
        `${t.offScale.length ? 'OFF-SCALE pcs:' + t.offScale : ''}`);
}
console.log(bad ? `\n${bad} malformed` : `\nall ${report.length} tracks well-formed and pentatonic`);

// now confirm the game actually selects the new tracks
async function trackAt(label, fn) {
    await fn();
    await page.waitForTimeout(150);
    console.log(label.padEnd(24), '->', await page.evaluate(() => DBG.track()));
}
await page.evaluate(() => localStorage.removeItem('xuanyuanSave'));
await page.reload();
await page.waitForTimeout(200);
console.log('\n--- which track plays where ---');
console.log('title screen'.padEnd(24), '->', await page.evaluate(() => DBG.track()));
await page.click('#btnNew');
await page.waitForTimeout(200);
for (let i = 0; i < 30; i++) {
    if (!(await page.isVisible('#dialog'))) break;
    await page.keyboard.press('Enter'); await page.waitForTimeout(60);
}
await trackAt('overworld', async () => {});
await trackAt('town 1 桃源村', () => page.evaluate(() => openTown(1)));
await trackAt('town 2 青丘寨', () => page.evaluate(() => openTown(2)));
await trackAt('town 3 望川鎮', () => page.evaluate(() => openTown(3)));
await browser.close();
