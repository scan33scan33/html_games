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
        Y: '#b5892f', Z: '#8a6522',   // ochre / ochre dark (Ochre, the muralist)
        W: '#f4f4f4',                 // pale cloth
        I: '#3563cf', i: '#24418a',   // cobalt / cobalt shadow (Cobalt, the lens-grinder)
        G: '#cfe6ff',                 // pale glass (a ground lens)
        // landmarks
        q: '#d94f2b', Q: '#a3341a',   // torii vermilion / shadow
        z: '#4a5160',                 // cold cut stone (幽都之門)
        x: '#3d211a', X: '#5a3226',   // basalt crust / lit basalt
    };

    // ---- sprite grids (16x16 unless noted) ----
    const SPRITES = {
        // The hero — a small swordsman facing the viewer, blade at his side.
        // Three frames: [0] stood still, [1] left foot lifted, [2] right foot
        // lifted. Walk by cycling 0,1,0,2 (see WALK_SEQ in index.html); frame 0
        // is what the battle UI and any static draw gets.
        player: [[
            '................',
            '.....kkkk.......',
            '....khhhhk......',
            '....hsssssh.....',
            '....hsesesh.....',
            '....hSssssS.....',
            '.....kSSSk......',
            '....kbbbbbk.....',
            '...rRrrrrRr.q...',
            '..rRRrrrrRRr.t..',
            '..rRRrrrrRRr.t..',
            '..rRRrrrrRRr....',
            '...RRr..rRR.....',
            '...kk....kk.....',
            '................',
            '................',
        ], [
            '................',
            '.....kkkk.......',
            '....khhhhk......',
            '....hsssssh.....',
            '....hsesesh.....',
            '....hSssssS.....',
            '.....kSSSk......',
            '....kbbbbbk.....',
            '...rRrrrrRr.q...',
            '..rRRrrrrRRr.t..',
            '..rRRrrrrRRr.t..',
            '..rRRrrrrRRr....',
            '...RRr..rRR.....',
            '.........kk.....',
            '................',
            '................',
        ], [
            '................',
            '.....kkkk.......',
            '....khhhhk......',
            '....hsssssh.....',
            '....hsesesh.....',
            '....hSssssS.....',
            '.....kSSSk......',
            '....kbbbbbk.....',
            '...rRrrrrRr.q...',
            '..rRRrrrrRRr.t..',
            '..rRRrrrrRRr.t..',
            '..rRRrrrrRRr....',
            '...RRr..rRR.....',
            '...kk...........',
            '................',
            '................',
        ]],
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
            '......ttt.......',
            '......ttt.......',
            '......ttt.......',
            '.....ttttt......',
            '................',
            '................',
        ],
        // a taller, narrower pine — mixed into forest tiles on a per-tile hash so
        // the canopy isn't one grid of identical stamps
        tree2: [
            '................',
            '.......f........',
            '......fFf.......',
            '.....ffFff......',
            '......fFf.......',
            '.....ffFff......',
            '....ffFFFff.....',
            '.....ffFff......',
            '....ffFFFff.....',
            '...ffFFFFFff....',
            '....ffFFFff.....',
            '..ffFFFFFFFff...',
            '.......t........',
            '......ttt.......',
            '.....ttttt......',
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
        // a lower twin-summit ridge. `peak` is near-symmetric, so mirroring it
        // changes almost nothing — a whole range needs a second silhouette.
        peak2: [
            '................',
            '................',
            '................',
            '....k......k....',
            '...kwk....kwk...',
            '..kwwwk..kwwwk..',
            '.kMwwwMkkMwwwMk.',
            '.kMMMMMMMMMMMMk.',
            'kMMMMmMMMMmMMMMk',
            'kMMMmmmMMmmmMMMk',
            'kMMmmmmmmmmmmMMk',
            'kMmmmmmmmmmmmmMk',
            '.kkkkkkkkkkkkkk.',
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
            '...hhssssh.h....',
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
        // Cobalt — the lens-grinder, in a deep-blue coat, holding up a ground lens.
        qingxuan: [
            '................',
            '....hhhhhh......',
            '...hhssssh......',
            '...hsesesh......',
            '...hSssssS......',
            '....kIIIk.......',
            '...IiIIIIi..GG..',
            '..IiIIIIIi.GVG..',
            '..IiIIIIIi..GG..',
            '..IiIIIIIi......',
            '...IiIIIi.......',
            '...IiI.IiI......',
            '...kk...kk......',
            '................',
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
        // Water sparkle, drawn atop the water-coloured tile. Four frames: the
        // crests drift down-right and the highlights break and reform, so a lake
        // ripples instead of sitting there as a frozen pattern.
        wave: [[
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
        ], [
            '................',
            '................',
            '................',
            '...UU......UU...',
            '..U..U....U..U..',
            '................',
            '.......UU.......',
            '......U..U......',
            '................',
            '...UU......UU...',
            '..U..U....U..U..',
            '................',
            '................',
            '................',
            '................',
            '................',
        ], [
            '................',
            '................',
            '................',
            '....UU......UU..',
            '...U..U....U..U.',
            '................',
            '........UU......',
            '.......U..U.....',
            '................',
            '....UU......UU..',
            '...U..U....U..U.',
            '................',
            '................',
            '................',
            '................',
            '................',
        ], [
            '................',
            '................',
            '................',
            '.UU......UU.....',
            'U..U....U..U....',
            '................',
            '.....UU.........',
            '....U..U........',
            '................',
            '.UU......UU.....',
            'U..U....U..U....',
            '................',
            '................',
            '................',
            '................',
            '................',
        ]],

        // ---- world landmarks (dungeon entrances & event sites) ----
        // 神農洞 — a vermilion torii on stone footings
        shrine: [
            '................',
            '................',
            '.qqqqqqqqqqqqqq.',
            '.QQQQQQQQQQQQQQ.',
            '................',
            '...qq......qq...',
            '..qqqqqqqqqqqq..',
            '..QQQQQQQQQQQQ..',
            '...qQ......qQ...',
            '...qQ......qQ...',
            '...qQ......qQ...',
            '...qQ......qQ...',
            '..jjjj....jjjj..',
            '..JJJJ....JJJJ..',
            '................',
            '................',
        ],
        // 祝融火窟 — a cinder cone, lava in the crater and running down the flanks.
        // Basalt rather than the mountain greys, so it doesn't read as just
        // another 'peak' tile with a spark on it.
        volcano: [
            '................',
            '........v.......',
            '.....v..V.......',
            '.....kkVvkk.....',
            '....kXVvvVXk....',
            '...kXXXXXXXXk...',
            '..kXXvXXXXvXXk..',
            '..kXXvXXXXvXXk..',
            '.kXXXvXxxXvXXXk.',
            '.kXXXvxxxxvXXXk.',
            'kXXXxvxxxxvxXXXk',
            'kXXxxxxxxxxxXXXk',
            '.kkkkkkkkkkkkkk.',
            '................',
            '................',
            '................',
        ],
        // 河伯水府 — a two-tier pagoda, teal roofs and a gold finial
        pagoda: [
            '.......b........',
            '.......b........',
            '......rrr.......',
            '.....rrrrr......',
            '....rrrrrrr.....',
            '...RRRRRRRRR....',
            '.....yyyyy......',
            '....rrrrrrr.....',
            '...rrrrrrrrr....',
            '..RRRRRRRRRRR...',
            '....yyyyyyy.....',
            '....ydddddy.....',
            '....yd.b.dy.....',
            '....yd...dy.....',
            '...kkkkkkkkk....',
            '................',
        ],
        // 劍塚 — a blade driven into a cairn, hilt to the sky
        tomb: [
            '................',
            '.......k........',
            '.......g........',
            '......kgk.......',
            '......kgk.......',
            '......kgk.......',
            '....bbbgbbb.....',
            '....kkbkkkk.....',
            '.......b........',
            '.......b........',
            '....jjjjjjj.....',
            '...jjjjjjjjj....',
            '..jJJJJJJJJJj...',
            '..jJJJJJJJJJj...',
            '..kkkkkkkkkkk...',
            '................',
        ],
        // 幽都之門 — a cut-stone arch around a purple void. Silhouetted (corners
        // transparent) so it reads as a gateway rather than a black box on the map.
        gate: [
            '................',
            '.....kkkkkk.....',
            '....kzzzzzzk....',
            '...kzzkkkkzzk...',
            '..kzzkpPPpkzzk..',
            '..kzkpPDDPpkzk..',
            '..kzkpPDDPpkzk..',
            '..kzkpPDDPpkzk..',
            '..kzkpPDDPpkzk..',
            '..kzkpPDDPpkzk..',
            '..kzkpPDDPpkzk..',
            '..kzkpPDDPpkzk..',
            '..kzkpPDDPpkzk..',
            '.kzzkpPDDPpkzzk.',
            '.kzzzkkkkkkzzzk.',
            '.kkkkkkkkkkkkkk.',
        ],
        // 妖巢 — a cobweb anchored in the corner, spider sitting out on it.
        // (Anchored rather than centred on purpose: a centred radial web reads
        // as a snowflake at this size.)
        nest: [
            '................',
            '.nnnnnnnnnnnnnnn',
            '.nnnn.n...n...n.',
            '.nnn.nnn..n...n.',
            '.nn.nn.nnnn...n.',
            '.n.nnn...nnnn.n.',
            '.nnn..k.nk..nnn.',
            '.n.nn..kk....nnn',
            '.n..n.nkk...nn..',
            '.n..nnk..k..n...',
            '.nnnnn....nn....',
            '.n...n....nn....',
            '.n...nn.nn..n...',
            '.n....nnn....n..',
            '.nnnnnnn......n.',
            '.n.....n.......n',
        ],
        // 商隊營地 — a pitched tent with a campfire beside it
        camp: [
            '................',
            '................',
            '.......b........',
            '......yy........',
            '.....yyyy.......',
            '....yyyyyy......',
            '....yydyyy......',
            '...yyyd.yyy.....',
            '...yyd..dyy.....',
            '..yyyd..dyyy....',
            '..kkkkkkkkkk....',
            '............v...',
            '...........vVv..',
            '..........tvVvt.',
            '..........tttt..',
            '................',
        ],

        // ---- dungeon tiles ----
        // 寶箱 — banded wooden chest
        chest: [
            '................',
            '................',
            '..kkkkkkkkkkkk..',
            '..kttttttttttk..',
            '..ktbbbbbbbbtk..',
            '..kttttttttttk..',
            '..kkkkkkkkkkkk..',
            '..kttttttttttk..',
            '..kttbbbbbbttk..',
            '..kttb.dd.bttk..',
            '..kttbbbbbbttk..',
            '..kttttttttttk..',
            '..kkkkkkkkkkkk..',
            '................',
            '................',
            '................',
        ],
        // 出口 — stone arch with daylight spilling through
        door: [
            '................',
            '....jjjjjjjj....',
            '...jJJJJJJJJj...',
            '..jJJJJJJJJJJj..',
            '..jJ.tttttt.Jj..',
            '..jJ.tyyyyt.Jj..',
            '..jJ.tyyyyt.Jj..',
            '..jJ.tyyyyt.Jj..',
            '..jJ.tybyyt.Jj..',
            '..jJ.tyyyyt.Jj..',
            '..jJ.tyyyyt.Jj..',
            '..jJ.tyyyyt.Jj..',
            '..jJ.tttttt.Jj..',
            '..jJJJJJJJJJJj..',
            '..kkkkkkkkkkkk..',
            '................',
        ],
        // 熔岩 — basalt crust. The cracks are TRANSPARENT on purpose: the tile's
        // animated orange glow is painted underneath, so it pulses through them.
        lava: [
            'xxxxx.xxxxxxxx.x',
            'xXxxx.xxxXxxx.xx',
            'xxxx..xxxxxx.xxx',
            'xxx.xxxxXxx.xxxX',
            'xx.xxxxxxx.xxxxx',
            'x.xxxXxxx.xxXxxx',
            '..xxxxxxx.xxxxx.',
            'xxxxxxxx.xxxxx..',
            'xxxXxxx.xxxxx.xx',
            'xxxxxx.xxxXx.xxx',
            'xxxxx.xxxxx.xxxx',
            'xxxX.xxxxx.xxxXx',
            'xxx.xxxXx.xxxxxx',
            'xx.xxxxx.xxxxxxx',
            'x.xxxxx.xxxXxxxx',
            '.xxxxx.xxxxxxxxx',
        ],
    };

    const cache = {};

    // A sprite is either one grid (array of row strings) or several — an array of
    // grids, one per animation frame. frames() normalises both to a frame list, so
    // every static sprite keeps working untouched.
    const isGrid = v => Array.isArray(v) && typeof v[0] === 'string';
    const lists = {};   // name -> frame list; cached, since the tile loop asks per tile per frame
    function frameList(name) {
        const v = SPRITES[name];
        if (!v) return null;
        return lists[name] || (lists[name] = isGrid(v) ? [v] : v);
    }

    function build(name, frame) {
        const list = frameList(name);
        const rows = list[frame % list.length];
        const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
        const h = rows.length;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d');
        for (let y = 0; y < h; y++) {
            const row = rows[y];
            for (let x = 0; x < row.length; x++) {
                const ch = row[x];
                const col = PALETTE[ch];
                // A char with no palette entry draws as a hole and is almost always a
                // typo (a stray space reads exactly like '.'). Say so rather than
                // silently swallowing it; '.' is the way to ask for transparency.
                if (col === undefined) console.warn('sprite "' + name + '" frame ' + frame +
                    ' row ' + y + ': unknown palette char ' + JSON.stringify(ch) +
                    ' — drawn transparent');
                if (!col) continue;
                cx.fillStyle = col;
                cx.fillRect(x, y, 1, 1);
            }
        }
        (cache[name] || (cache[name] = []))[frame] = c;
        return c;
    }
    function raster(name, frame) {
        const list = frameList(name);
        const f = list.length > 1 ? ((frame | 0) % list.length + list.length) % list.length : 0;
        return (cache[name] && cache[name][f]) || build(name, f);
    }

    const SPR = {
        has(name) { return !!SPRITES[name]; },
        // register/replace a sprite at runtime — one grid, or an array of grids
        // for an animation. Lets you try art from the console or a harness page.
        add(name, rows) {
            SPRITES[name] = rows;
            delete lists[name]; delete cache[name]; delete tagCache[name];
        },
        // how many animation frames `name` has (1 for a plain static grid)
        frames(name) { const l = frameList(name); return l ? l.length : 0; },
        // the raw frame grids for `name`, normalised to a list of frames even for
        // a single-grid sprite. For tooling (see test/lint_sprites.mjs) — parsing
        // this file with a regex instead is how you end up linting the wrong thing.
        grids(name) { return frameList(name); },
        // the palette, so tooling can check chars against the real thing
        palette() { return Object.assign({}, PALETTE); },
        // draw sprite `name` in a `size`x`size` cell at (dx,dy) top-left.
        // `flip` mirrors horizontally — cheap variety when one grid tiles a whole
        // forest or mountain range and the repetition starts to show.
        // `frame` picks an animation frame; it wraps, so callers can pass a
        // free-running counter and ignore the frame count.
        blit(ctx, name, dx, dy, size, flip, frame) {
            const c = raster(name, frame || 0);
            const prev = ctx.imageSmoothingEnabled;
            ctx.imageSmoothingEnabled = false;
            if (flip) {
                ctx.save();
                ctx.translate(dx + size, dy);
                ctx.scale(-1, 1);
                ctx.drawImage(c, 0, 0, size, size);
                ctx.restore();
            } else {
                ctx.drawImage(c, dx, dy, size, size);
            }
            ctx.imageSmoothingEnabled = prev;
        },
        // convenience: draw centered on a point with a given pixel height
        blitCenter(ctx, name, cxp, cyp, size, flip, frame) {
            this.blit(ctx, name, cxp - size / 2, cyp - size / 2, size, flip, frame);
        },
        // return an <img> HTML string (cached data-URL) for use in innerHTML —
        // handy for the DOM-based battle UI. Falls back to '' if no such sprite.
        // Always frame 0: the battle UI is DOM, so it can't animate anyway.
        tag(name, size) {
            if (!SPRITES[name]) return '';
            if (!tagCache[name]) tagCache[name] = raster(name, 0).toDataURL();
            return '<img class="pixspr" width="' + size + '" height="' + size +
                '" src="' + tagCache[name] + '" alt="">';
        },
        list() { return Object.keys(SPRITES); },
    };
    const tagCache = {};

    window.SPR = SPR;
})();
