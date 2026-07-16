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
console.log(bad ? `\n${bad} malformed` : `${report.length} tracks well-formed and pentatonic`);

// Confirm the game actually SELECTS each track. This half used to only print
// what it found, so re-pointing the title screen at the town theme sailed
// straight through — a check that can't fail is worse than no check.
async function trackAt(label, want, fn) {
    if (fn) await fn();
    await page.waitForTimeout(150);
    const got = await page.evaluate(() => DBG.track());
    const ok = got === want;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(22)} -> ${got}${ok ? '' : '  (expected ' + want + ')'}`);
}
await page.evaluate(() => localStorage.removeItem('xuanyuanSave'));
await page.reload();
await page.waitForTimeout(200);
console.log('\n--- which track plays where ---');
await trackAt('title screen', 'title', null);
await page.click('#btnNew');
await page.waitForTimeout(200);
for (let i = 0; i < 30; i++) {
    if (!(await page.isVisible('#dialog'))) break;
    await page.keyboard.press('Enter'); await page.waitForTimeout(60);
}
await trackAt('overworld', 'overworld', async () => {});
await trackAt('town 1 桃源村', 'town', () => page.evaluate(() => openTown(1)));
await trackAt('town 2 青丘寨', 'fox', () => page.evaluate(() => openTown(2)));
await trackAt('town 3 望川鎮', 'desert', () => page.evaluate(() => openTown(3)));
await trackAt('劍塚 (forge)', 'forge', () => page.evaluate(() => {
    $('town').classList.remove('open');
    S.flags.crystals = { earth: true, fire: true, water: true };
    tryEnterDungeon('tomb');
}));
console.log(bad ? `\n${bad} problem(s)` : '\nall tracks well-formed, pentatonic, and wired to the right places');
await browser.close();
process.exit(bad ? 1 : 0);
