// A report, not a pass/fail check. Gear decides the fights (see report_curve),
// so the real gate is gold: does the critical path pay for the gear it expects?
// Run it after touching drop rates, chest contents or shop prices.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('http://localhost:8765/xuanyuan/');

const r = await page.evaluate(() => {
    const tierGold = {};
    for (const t of [1, 2, 3, 4]) {
        const pool = TIERS[t] || [];
        if (!pool.length) { tierGold[t] = 0; continue; }
        const avg = pool.reduce((s, id) => s + (MON[id] ? MON[id].gold : 0), 0) / pool.length;
        tierGold[t] = Math.round(avg * 2);      // ~2 mobs per encounter
    }
    // chest contents across every dungeon
    let chestGold = 0, chestItems = 0;
    for (const [id, D] of Object.entries(DUNGEONS)) {
        for (const c of Object.values(D.chests || {})) {
            if (c.gold) chestGold += c.gold;
            if (c.item) chestItems++;
        }
    }
    const bossGold = ['tubo', 'bifang', 'gonggong', 'jianling', 'xuanyuan_w']
        .reduce((s, b) => s + BOSSES[b].gold, 0);
    // the shopping list, by gear tier, for all three heroes + armour
    const cost = tier => {
        let c = 0;
        for (const id of ['auron', 'lyra', 'zephyr']) {
            const w = WEAPONS[id][tier];
            if (w) c += w.cost;
        }
        c += (ARMORS[tier] ? ARMORS[tier].cost : 0) * 3;   // one each
        return c;
    };
    return { tierGold, chestGold, chestItems, bossGold, start: 150,
             gear1: cost(1), gear2: cost(2), gear3: cost(3),
             inns: TOWNS[1].inn + TOWNS[2].inn + TOWNS[3].inn };
});

console.log('gold per encounter by tier :', JSON.stringify(r.tierGold));
console.log('chest gold (all dungeons)  :', r.chestGold, `(+${r.chestItems} item chests)`);
console.log('boss gold (5 bosses)       :', r.bossGold);
console.log('starting purse             :', r.start);

const enc = { 1: 12, 2: 8, 3: 10, 4: 12 };
let battle = 0;
for (const t of [1, 2, 3, 4]) battle += enc[t] * (r.tierGold[t] || 0);
const income = r.start + battle + r.chestGold + r.bossGold;
console.log(`\n~42 encounters ≈ ${battle} 兩 + chests ${r.chestGold} + bosses ${r.bossGold} + start ${r.start}`);
console.log(`=> a critical-path player earns about ${income} 兩`);

console.log('\nshopping list (3 heroes, weapon + armour each):');
console.log('  tier 1 (青銅劍/皮甲)  :', r.gear1, '兩');
console.log('  tier 2 (百煉劍/鎖子甲):', r.gear2, '兩');
console.log('  tier 3 (湛盧/軟蝟甲)  :', r.gear3, '兩');
console.log('  cumulative to tier 3 :', r.gear1 + r.gear2 + r.gear3, '兩 (if you buy every step)');
console.log('\npotions also compete for this purse: 大還丹 is 120 each.');
await browser.close();
