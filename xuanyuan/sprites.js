/* =============================================================================
 *  軒轅殘劍 — procedural sprite engine
 *
 *  Sprites are authored as 16x16 (or NxN) character grids. Each character maps
 *  to a colour in PALETTE ('.' = transparent). Each sprite is rasterised ONCE
 *  to an offscreen canvas at native pixel resolution and cached; blit() then
 *  draws it scaled with smoothing off, so it stays crisp pixel-art at any size.
 *
 *  ---- HOW TO DEVELOP A SPRITE -------------------------------------------------
 *  1. Add colours you need to PALETTE below (single char -> hex).
 *  2. Add an entry to SPRITES: an array of equal-length rows of palette chars.
 *     Rows are auto-padded/trimmed to the widest row, so a miscount degrades
 *     gracefully instead of breaking. Keep '.' for transparency.
 *  3. Map a game tile/entity to it in the calling code (index.html) — e.g.
 *     SPR.blit(ctx, 'tree', px, py, TILE).
 *  4. Reload the page. No build step. Edit, save, refresh.
 *  ---------------------------------------------------------------------------- */
(function () {
    'use strict';

    const PALETTE = {
        '.': null,               // transparent
        k: '#14141c',            // outline / near-black
        s: '#e8b88c',            // skin
        S: '#c98f68',            // skin shadow
        h: '#2b2b33',            // hair
        e: '#20202a',            // eye
        r: '#2e6f7a',            // robe (teal)
        R: '#1f4d55',            // robe shadow
        b: '#c9a35f',            // belt / gold
        g: '#d8dde3',            // blade / bright metal
        // greenery
        f: '#4e9a4e', F: '#3a7a3a', t: '#6b4a2b',
        // mountain
        M: '#7a7469', m: '#5a554f', w: '#e8ecf2',
        // building
        o: '#8a3b2e', O: '#6e2c22', y: '#d9c9a8', d: '#3a2d1e', L: '#e74c3c',
        // water
        u: '#2e5d7d', U: '#8fc4e6',
        // creatures & party
        a: '#c0392b', A: '#7f2418',   // imp red / dark
        c: '#7a7f88', C: '#565b63',   // wolf grey / dark
        n: '#e8e6df',                 // bone
        p: '#9b59b6', P: '#6b4a8a',   // purple / dark purple
        v: '#e8622a', V: '#f1c40f',   // fire orange / yellow
        j: '#8a8578', J: '#615d52',   // stone / stone dark
        D: '#2a2440',                 // dark navy
        Y: '#b5892f', Z: '#8a6522',   // ochre / ochre dark (墨璃)
        W: '#f4f4f4',                 // fox white (青璇)
    };

    // ---- sprite grids (16x16 unless noted) ----
    const SPRITES = {
        // the hero — a small swordsman facing the viewer, blade at his side
        player: [
            '................',
            '.....kkkk.......',
            '....khhhhk......',
            '....hsssssh.....',
            '....hsesesh.....',
            '....hSssssS.....',
            '.....kSSSk......',
            '....kbbbbbk.....',
            '...rRrrrrRr.g...',
            '..rRRrrrrRRr g..',
            '..rRRrrrrRRr.k..',
            '..rRRrrrrRRr....',
            '...RRr..rRR.....',
            '...kk....kk.....',
            '................',
            '................',
        ],
        // bamboo / tree cluster for forest tiles
        tree: [
            '................',
            '......fff.......',
            '.....ffFff......',
            '....ffFFFff.....',
            '...ffFFFFFff....',
            '...fFFFFFFFf....',
            '..ffFFFFFFFff...',
            '...fFFFFFFFf....',
            '....ffFFFff.....',
            '.....fffFf......',
            '......tt t......',
            '......ttt.......',
            '......ttt.......',
            '.....ttttt......',
            '................',
            '................',
        ],
        // snow-capped mountain peak
        peak: [
            '................',
            '................',
            '.......k........',
            '......kwk.......',
            '.....kwwwk......',
            '....kwwwwwk.....',
            '...kMMwwwMMk....',
            '..kMMMMMMMMMk...',
            '.kMMMMMmMMMMMk..',
            'kMMMMMmmmMMMMMk.',
            'kMMMMmmmmmMMMMk.',
            'kMMMmmmmmmmMMMk.',
            '.kkkkkkkkkkkkk..',
            '................',
            '................',
            '................',
        ],
        // village hut with a red lantern
        house: [
            '................',
            '......ooo.......',
            '.....ooooo......',
            '....ooooooo.....',
            '...ooooooooo....',
            '..kOOOOOOOOOk...',
            '..kyyyyyyyyyk...',
            '..kyydddyyyk....',
            '..kyyd.dyyyk....',
            '..kyyd.dyyyk....',
            '..kyydddyyyk....',
            '..kkkkkkkkkk....',
            '.......L........',
            '......LLL.......',
            '.......L........',
            '................',
        ],
        // ---- party members (battle portraits) ----
        // 墨璃 — Mohist artisan, ochre robes, holding a mechanism bolt
        muli: [
            '................',
            '.....hhhh.......',
            '....hhhhhh......',
            '...hhssssh h....',
            '...hsesesh.h....',
            '...hSssssS......',
            '....kbbbk.......',
            '...YZYYYZY......',
            '..YZYYYYYZY.g...',
            '..YZYYYYYZY.k...',
            '..YZYYYYYZY.....',
            '...YZYYYZY......',
            '...YZY.YZY......',
            '...kk...kk......',
            '................',
            '................',
        ],
        // 青璇 — nine-tailed fox spirit, white robes, orange ears & tail
        qingxuan: [
            '................',
            '...v......v.....',
            '...vk....kv.....',
            '....khhhhk......',
            '...khssssh......',
            '...hsesesh......',
            '...hSssssS......',
            '....kWWWk.......',
            '...WWWWWWW..vv..',
            '..WWWWWWWWW.vvv.',
            '..WWWWWWWWW.vv..',
            '..WWWWWWWWW.....',
            '...WWW.WWW......',
            '...kk...kk......',
            '................',
            '................',
        ],
        // ---- monsters (tier 1) ----
        shanxiao: [
            '................',
            '....a....a......',
            '...aaAAAAaa.....',
            '..aAAAAAAAAa....',
            '..aAeAAAAeAa....',
            '..aAAAwwAAAa....',
            '..aAAwwwwAAa....',
            '...aAAAAAAAa....',
            '....aAAAAa......',
            '...aa.aa.aa.....',
            '..aa..aa..aa....',
            '................',
            '................',
            '................',
            '................',
            '................',
        ],
        fuyao: [
            '................',
            '................',
            '.h............h.',
            '.hh..hhhh..hh.h.',
            '.hhhhhCCCChhhhh.',
            '..hhhCC..CChhh..',
            '...hhC.ee.Chh...',
            '....hCCCCCCh....',
            '.....hCCCCh.....',
            '......h..h......',
            '................',
            '................',
            '................',
            '................',
            '................',
            '................',
        ],
        yaolang: [
            '................',
            '..c..........c..',
            '..cc........cc..',
            '..cCc......cCc..',
            '..cCCcccccccCc..',
            '.cCCeCCCCCCeCCc.',
            '.cCCCCwwwwCCCCc.',
            '.cCCCCCCCCCCCCc.',
            '..CCCCCCCCCCCC..',
            '..C.CC.CC.CC.C..',
            '..k..k..k..k....',
            '................',
            '................',
            '................',
            '................',
            '................',
        ],
        shijing: [
            '................',
            '................',
            '...jjjjjjjj.....',
            '..jJjjjjjjJj....',
            '..jjeJjjJejj....',
            '..jJjjjjjjJj....',
            '..jjJwwwwJjj....',
            '..jJjjjjjjJj....',
            '..jjJjjjjJjj....',
            '...jjjjjjjj.....',
            '...jj....jj.....',
            '..jj......jj....',
            '................',
            '................',
            '................',
            '................',
        ],
        // ---- bosses ----
        tubo: [
            '................',
            '...jjjjjjjjjj...',
            '..jJJJJJJJJJJj..',
            '.jJJjjjjjjjjJJj.',
            '.jJjeJjjjjJejJj.',
            '.jJjjjjjjjjjjJj.',
            '.jJJjwwwwwwjJJj.',
            '.jJjjwJJJJwjjJj.',
            '.jJJjjjjjjjjJJj.',
            '..jJJJJJJJJJJj..',
            '..jj.jjjj.jj.j..',
            '.jj..jj.jj..jj..',
            '................',
            '................',
            '................',
            '................',
        ],
        bifang: [
            '................',
            '.......VV.......',
            '......VvvV......',
            '.....VvaavV.....',
            '....VvaeaavV....',
            '...VvaaaaaavV...',
            '..VvaaaAAaaavV..',
            '.VvaaaAAAAaaavV.',
            '..VvaaAAAAaavV..',
            '...VvaaaaaavV...',
            '....Vva..avV....',
            '.....v....v.....',
            '....vv....vv....',
            '................',
            '................',
            '................',
        ],
        gonggong: [
            '................',
            '..UU........UU..',
            '.UuuU......UuuU.',
            '.Uuru......uruU.',
            '..Uuu......uuU..',
            '...UuuUUUUuuU...',
            '..UuuruuuuruuU..',
            '.UuueuuuuuueUuU.',
            '.UuuuuwwwwuuuuU.',
            '..UuuuuuuuuuuU..',
            '...UuuuuuuuuU...',
            '....UUuuuuUU....',
            '......UUUU......',
            '................',
            '................',
            '................',
        ],
        xuanyuan_w: [
            '................',
            '.....DDDDDD.....',
            '....DPPPPPPD....',
            '...DPphhhhpPD...',
            '...DPhehhehpD...',
            '...DPhhhhhhpD...',
            '...DPpggggpPD...',
            '..DPPphhhhpPPD..',
            '..DPphhhhhhpPD..',
            '..DPphhhhhhpPD..',
            '..DPphh..hhpPD..',
            '...Dph....hpD...',
            '...DD......DD...',
            '................',
            '................',
            '................',
        ],
        shihun: [
            '................',
            '...DDDDDDDDDD...',
            '..DDpPppPpPpDD..',
            '.DDpPpWWWWpPpDD.',
            '.DpPpWWWWWWpPpD.',
            '.DpPWWWppWWWPpD.',
            '.DpPWWpaapWWPpD.',
            '.DpPWWpaapWWPpD.',
            '.DpPWWWppWWWPpD.',
            '.DpPpWWWWWWpPpD.',
            '.DDpPpWWWWpPpDD.',
            '..DDpPppPpPpDD..',
            '...DDDDDDDDDD...',
            '................',
            '................',
            '................',
        ],
        // water sparkle (drawn atop the water-coloured tile)
        wave: [
            '................',
            '................',
            '................',
            '..UU......UU....',
            '.U..U....U..U...',
            '................',
            '......UU........',
            '.....U..U.......',
            '................',
            '..UU......UU....',
            '.U..U....U..U...',
            '................',
            '................',
            '................',
            '................',
            '................',
        ],
    };

    const cache = {};

    function build(name) {
        const rows = SPRITES[name];
        const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
        const h = rows.length;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d');
        for (let y = 0; y < h; y++) {
            const row = rows[y];
            for (let x = 0; x < row.length; x++) {
                const col = PALETTE[row[x]];
                if (!col) continue;
                cx.fillStyle = col;
                cx.fillRect(x, y, 1, 1);
            }
        }
        cache[name] = c;
        return c;
    }

    const SPR = {
        has(name) { return !!SPRITES[name]; },
        // draw sprite `name` centered in a `size`x`size` cell at (dx,dy) top-left
        blit(ctx, name, dx, dy, size) {
            const c = cache[name] || build(name);
            const prev = ctx.imageSmoothingEnabled;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(c, dx, dy, size, size);
            ctx.imageSmoothingEnabled = prev;
        },
        // convenience: draw centered on a point with a given pixel height
        blitCenter(ctx, name, cxp, cyp, size) {
            this.blit(ctx, name, cxp - size / 2, cyp - size / 2, size);
        },
        // return an <img> HTML string (cached data-URL) for use in innerHTML —
        // handy for the DOM-based battle UI. Falls back to '' if no such sprite.
        tag(name, size) {
            if (!SPRITES[name]) return '';
            if (!tagCache[name]) tagCache[name] = (cache[name] || build(name)).toDataURL();
            return '<img class="pixspr" width="' + size + '" height="' + size +
                '" src="' + tagCache[name] + '" alt="">';
        },
        list() { return Object.keys(SPRITES); },
    };
    const tagCache = {};

    window.SPR = SPR;
})();
