// A report, not a pass/fail check.
//
// report_curve.mjs models NO healing, so every ✗ in it is a floor — but healing
// is the mechanic this game is actually built on (you arrive at the finale
// under-levelled by design and heal your way through). So: Monte-Carlo the real
// fight, using the game's own heroStats/rnd/damage/potion numbers, and find out
// whether a critical-path party actually wins and how much medicine it costs.
//
// Rules mirrored from index.html:
//   hero hit    : rnd(atk*2 - def)                       (:1974)
//   enemy hit   : rnd(atk*2 - def), random living target (:2151)
//   enemy spell : every 3rd turn, rnd(power + atk*0.6 - def*0.4) on everyone (:2131)
//   rnd(v)      : v * (0.85..1.15)                       (:1963)
//   大還丹      : +150 hp, one hero, costs the turn
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('http://localhost:8765/xuanyuan/');

const RUNS = 1000;
const out = await page.evaluate(({ RUNS }) => {
    const R = v => Math.round(v * (0.85 + Math.random() * 0.3));
    const statsAt = (id, lv, gear) => heroStats({ id, lv, weapon: gear, armor: gear });

    // one fight; returns {win, potionsUsed}
    function sim(lv, gear, bossId, potions, healAt, healPower, ids) {
        const party = ids.map(id => {
            const st = statsAt(id, lv, gear);
            return { id, st, hp: st.maxhp };
        });
        const B = BOSSES[bossId];
        const sp = B.spell ? ENEMY_SPELLS[B.spell] : null;
        let bhp = B.hp, bag = potions, turn = 0, used = 0;
        for (let round = 0; round < 100; round++) {
            // party acts
            for (const h of party) {
                if (h.hp <= 0) continue;
                if (bhp <= 0) break;
                if (bag > 0 && h.hp < h.st.maxhp * healAt) {
                    h.hp = Math.min(h.st.maxhp, h.hp + healPower);
                    bag--; used++;
                    continue;                                   // healing costs the turn
                }
                bhp -= Math.max(1, R(h.st.atk * 2 - B.def));
            }
            if (bhp <= 0) return { win: true, used };
            // boss acts
            turn++;
            const alive = party.filter(h => h.hp > 0);
            if (!alive.length) return { win: false, used };
            if (sp && turn % 3 === 0) {
                for (const h of alive) h.hp -= Math.max(1, R(sp.power + B.atk * 0.6 - h.st.def * 0.4));
            } else {
                const t = alive[Math.floor(Math.random() * alive.length)];
                t.hp -= Math.max(1, R(B.atk * 2 - t.st.def));
            }
            if (!party.some(h => h.hp > 0)) return { win: false, used };
        }
        return { win: false, used };   // stalemate = loss
    }

    const rate = (lv, gear, boss, potions, heal, ids) => {
        let wins = 0, used = 0;
        for (let i = 0; i < RUNS; i++) {
            const r = sim(lv, gear, boss, potions, 0.5, heal, ids);
            if (r.win) { wins++; used += r.used; }
        }
        return { rate: wins / RUNS, avgUsed: wins ? used / wins : 0 };
    };
    const early = [], late = [];
    // 土伯: fought with TWO heroes (青璇 joins at 青丘寨, after), and 桃源村 is
    // tier 1 so 金創藥 (+50) is the only medicine on sale.
    for (const lv of [4, 5, 6, 7, 8])
        for (const gear of [0, 1])
            early.push({ lv, gear, cells: [0, 3, 8].map(p => rate(lv, gear, 'tubo', p, 50, ['auron', 'lyra'])) });
    // 噬魂: three heroes, 大還丹 (+150)
    for (const lv of [10, 12, 13, 14, 16, 18])
        for (const gear of [2, 3])
            late.push({ lv, gear, cells: [0, 10, 20].map(p => rate(lv, gear, 'shihun', p, 150, ['auron', 'lyra', 'zephyr'])) });
    return { early, late };
}, { RUNS });

const pct = c => ((c.rate * 100).toFixed(0) + '%').padStart(5) +
    (c.rate > 0.05 ? ('(' + c.avgUsed.toFixed(1) + ')').padStart(7) : ''.padStart(7));
function table(title, note, rows, cols) {
    console.log('\n' + title);
    console.log(note);
    console.log('\nlv gear ' + cols.map(c => String(c).padStart(12)).join(''));
    let last = null;
    for (const r of rows) {
        if (last !== null && r.lv !== last) console.log('');
        last = r.lv;
        console.log(String(r.lv).padStart(2), String(r.gear).padStart(4), r.cells.map(pct).join(''));
    }
}
console.log('Both fights simulated ' + RUNS + '× per row, drinking below 50% HP.');
console.log('NOT modelled, all in the player\'s favour: 防禦, 五行符, 回春術/兼愛無疆,');
console.log('every buff, and (for the finale) the free full-heal entering phase 2 plus');
console.log('玄淵\'s one-time 45% rescue. Real play is kinder than these numbers.');

table('土伯 (320hp/atk24) — the FIRST boss, as actually fought.',
    'Two heroes (青璇 joins at 青丘寨, after) and 金創藥 (+50), the only medicine\n' +
    '桃源村 sells. gear 0 = 鏽劍/布衣, 1 = 青銅劍/皮甲.',
    out.early, ['0 潛', '3 金創藥', '8 金創藥']);

table('噬魂・借體 (1800hp/atk66) — the finale.',
    'Three heroes and 大還丹 (+150). gear 2 = 百煉劍/鎖子甲, 3 = 湛盧/軟蝟甲.\n' +
    'A critical-path party arrives at about lv13.',
    out.late, ['0 潛', '10 大還丹', '20 大還丹']);

console.log('\n(win rate, and average potions spent when winning)');
await browser.close();
