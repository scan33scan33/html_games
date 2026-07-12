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
        list() { return Object.keys(SPRITES); },
    };

    window.SPR = SPR;
})();
