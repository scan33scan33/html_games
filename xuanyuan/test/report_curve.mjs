// A report, not a pass/fail check: what level each boss expects, modelled as a
// race using the game's own heroStats/BOSSES. No healing is modelled, so every
// number is a FLOOR — a real party heals and wins earlier. Run it after touching
// hero growth, weapon tables or boss stats to see the curve move.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('http://localhost:8765/xuanyuan/');

const r = await page.evaluate(() => {
    // Hero stats at a level AND a gear tier. Gear matters enormously here —
    // 鏽劍 is +2 atk and 湛盧 is +30 — so modelling weapon:0/armor:0 models a
    // player who never shops, which is not the intended player.
    const at = (id, lv, gear) => heroStats({ id, lv, weapon: gear, armor: gear });
    const bosses = ['tubo', 'bifang', 'gonggong', 'jianling', 'xuanyuan_w', 'shihun'];
    const out = { bosses: [], party: [], gearNames: [] };
    for (const b of bosses) {
        const B = BOSSES[b];
        out.bosses.push({ id: b, name: B.name, hp: B.hp, atk: B.atk, def: B.def, xp: B.xp });
    }
    for (let g = 0; g < 4; g++) out.gearNames.push(WEAPONS.auron[g].name + '/' + ARMORS[g].name);
    for (const lv of [4, 6, 8, 10, 12, 14, 16, 18, 20, 22]) {
        for (const gear of [0, 1, 2, 3]) {
            const a = at('auron', lv, gear);
            out.party.push({ lv, gear, hp: a.maxhp, atk: a.atk, def: a.def });
        }
    }
    return out;
});

console.log('A boss fight is a race: rounds to kill it vs rounds for it to kill you.');
console.log('Both sides use the game\'s real formula: damage = atk*2 - targetDef.');
console.log('(The boss hits for atk*2-def, NOT atk-def — getting that wrong halves');
console.log('every incoming hit and makes the game look far kinder than it is.)');
console.log('No healing is modelled.\n');
console.log('gear tiers:', r.gearNames.map((n, i) => i + '=' + n).join('  '), '\n');
console.log('lv gear  HP  atk def |  ' + r.bosses.map(b => b.name.padEnd(6)).join(' '));
let lastLv = null;
for (const p of r.party) {
    if (lastLv !== null && p.lv !== lastLv) console.log('');
    lastLv = p.lv;
    const cells = r.bosses.map(b => {
        const myDmg = Math.max(1, p.atk * 2 - b.def) * 3;         // 3 heroes
        const roundsToKill = Math.ceil(b.hp / myDmg);
        // index.html:2151 — `rnd(e.atk * 2 - st.def)`. The doubling applies to the
        // enemy too; modelling it as atk-def understates every hit by ~half.
        const theirDmg = Math.max(1, b.atk * 2 - p.def);
        const roundsToDie = Math.ceil((p.hp * 3) / theirDmg);     // whole party's HP pool
        const win = roundsToDie > roundsToKill;
        return ((win ? '' : '✗') + roundsToKill + 'v' + roundsToDie).padEnd(6);
    });
    console.log(String(p.lv).padStart(2), String(p.gear).padStart(4), String(p.hp).padStart(4),
        String(p.atk).padStart(4), String(p.def).padStart(3), '|  ' + cells.join(' '));
}
console.log('\nreads as "roundsToKillIt v roundsToKillYou"; ✗ = you lose the race');
console.log('gear moves this far more than levels do — compare a row against itself.');
await browser.close();
