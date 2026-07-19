// Validate every track: 8 bars × 8 steps of lead, 8 bass, 8 chords, 8-char drums,
// all notes in a sane MIDI range. Then confirm each scene selects its track.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:8765/lumenfall/');
const report = await p.evaluate(async () => {
    const src = await (await fetch('index.html')).text();
    const body = src.match(/const TRACKS = \{([\s\S]*?)\n    \};/)[1];
    const TRACKS = new Function('return {' + body + '}')();
    const out = [];
    for (const [name, t] of Object.entries(TRACKS)) {
        const notes = t.lead.flat().filter(n => n > 0);
        out.push({
            name, bars: t.lead.length,
            widths: [...new Set(t.lead.map(r => r.length))],
            bass: t.bass.length, chords: t.chords.length, drums: t.drums.length,
            lo: Math.min(...notes), hi: Math.max(...notes),
        });
    }
    return out;
});
let bad = 0;
for (const t of report) {
    const ok = t.bars === 8 && t.widths.length === 1 && t.widths[0] === 8 &&
               t.bass === 8 && t.chords === 8 && t.drums === 8 && t.lo >= 33 && t.hi <= 96;
    if (!ok) bad++;
    console.log(`${ok?'ok  ':'FAIL'} ${t.name.padEnd(10)} bars=${t.bars} steps=${t.widths} bass=${t.bass} chords=${t.chords} drums=${t.drums} range=${t.lo}-${t.hi}`);
}
console.log(bad ? `\n${bad} malformed` : `\nall ${report.length} tracks well-formed`);
// confirm the game selects them without error
const vis = s => p.isVisible(s).catch(()=>false);
async function drain(n=40){for(let i=0;i<n;i++){if(!(await vis('#dialog')))return;await p.keyboard.press('Enter');await p.waitForTimeout(45);}}
await p.evaluate(()=>localStorage.removeItem('lumenfallSave'));
await p.reload();
console.log('\n-- which track plays where --');
async function expect(label, want, got) {
    const ok = got === want;
    if (!ok) bad++;
    console.log(`${ok?'ok  ':'FAIL'} ${label.padEnd(22)} ${got}${ok?'':' (want '+want+')'}`);
}
await expect('title', 'title', await p.evaluate(()=>{ showTitle(); return DBG.track(); }));
await p.click('#btnNew');
await expect('prologue (intro)', 'prologue', await p.evaluate(()=>DBG.track()));
await drain();
await expect('overworld (post-intro)', 'overworld', await p.evaluate(()=>DBG.track()));
await expect("Marrow's End", 'town', await p.evaluate(()=>{ openTown(1); return DBG.track(); }));
await expect('shop', 'shop', await p.evaluate(()=>{ openShop(1); return DBG.track(); }));
await p.evaluate(()=>{ $('shop').classList.remove('open'); mode='world'; });
for (const [id,want] of [[4,'umber'],[5,'loomrest'],[6,'stillwater']]) {
    await expect('town '+id, want, await p.evaluate(i=>{ openTown(i); return DBG.track(); }, id));
    await p.evaluate(()=>{ $('town').classList.remove('open'); mode='world'; });
}
// region themes via mapTrack (no draw, so no dpos needed)
for (const [id,want] of [['earth','ashwood'],['fire','emberhollow'],['water','gallery'],['castle','wellspring']]) {
    await expect('region '+id, want, await p.evaluate(i=>{ dungeonId=i; return mapTrack(); }, id));
}
await p.evaluate(()=>{ dungeonId=null; });
console.log(bad ? `\n${bad} problem(s)` : '\nall tracks well-formed and wired to the right scenes');
await b.close();
process.exit(bad?1:0);
