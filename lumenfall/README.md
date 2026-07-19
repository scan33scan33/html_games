# Lumenfall — a painterly RPG about a world losing its color

A single-page, zero-build RPG. Open `index.html` in a browser (or serve the repo
statically) — no bundler, no install. It reuses the engine from the sibling
`xuanyuan/` game (battle, audio sequencer, canvas renderer, save, dialogue,
pathfinding) and replaces all of its content with an original story, world,
characters, and a new **color mechanic**.

## The story

A year ago the **Greydawn** came, and the world began to drain of color — flowers
ash over, the sky dims, and those whose color runs out become **the Faded**:
hollow, restful, gone. You are **Wren**, apprentice to old **Sable** the village
dyer. When Sable Fades before your eyes, you set out with her last words: gather
the three **Prisms** and carry them to the **Wellspring** at the world's heart,
where color is born.

**The twist** is earned across the three prism-visions, not sprung: the Greydawn
isn't a sickness to cure — it's a **mercy** the **Loomkeepers** are deliberately
completing. The world was once so vivid that feeling, change, grief and death were
unbearable; draining color halts change itself, and the Faded don't suffer, they
rest. Sable was a Loomkeeper, and gave her own color to spare Wren a bright, dying
life. The three Prisms aren't the cure — they're the last wild color, and the
Wellspring wants them to finish unwinding the world into painless grey forever.
The finale is the choice: safe grey stasis, or shatter the loom and let color —
and therefore mortality *and* joy — flood back. Two phases: the **Loomkeeper
Prime**, then the **Hollow Bloom** (all the suppressed grief, given a body — you
don't destroy it, you accept it, and color returns).

The theme: impermanence and art — the courage to choose a brief, bright, mortal
life over a safe grey stasis.

## The color mechanic (the engine's new feature)

The whole world renders **desaturated** — the Greydawn — via a CSS `filter` on the
game canvas, driven by story state (`colorFilter()` in `index.html`):

- **World map**: lifts one step toward full color with each Prism recovered
  (grayscale 0.80 → 0.54 → 0.28 → full).
- **Dungeons**: stay grey until their region's Prism is taken — which happens as
  you *leave* — so you fight through grey and step out into a colored world.
- **Ending**: color crashes back into everything at once.

It's cheap (the filter string is only written when it changes) and it makes story
progress *visible*: the world you're saving literally comes back to life around you.

## Combat — visible D20 dice

Every **weapon attack rolls a d20**, shown on screen (a tumbling die that settles
on its face). It replaces the old hidden ±15% damage roll:

- **nat 1** → a miss (0 damage),
- **nat 20** → a critical hit (×2 damage),
- everything between scales damage with the roll.

The average multiplier is ≈ 1.0, so the tuned balance is intact — this only makes
the randomness *visible*, D&D-style. Both heroes and the Faded roll. Spells stay
magic and don't roll (as in D&D, where weapon attacks roll to hit and many spells
don't). See `attackRoll()` / `showDie()` in `index.html`.

## Cast & systems

- **Party**: Wren (dyer's apprentice, physical), Ochre (muralist — tank, wards &
  heals), Cobalt (lens-grinder — offensive caster).
- **Elements**: a five-hue color wheel — ember / azure / verd / gold / ash — with
  a one-way advantage cycle (`KE`) and a harmony cycle (`SHENG`). Ash is the color
  of the Faded.
- **Structure**: a single **linear journey** to the Wellspring that passes through
  three regions — not a collect-a-thon. There's no prism counter in the HUD;
  instead a mood read ("the world lies grey" → "color stirs" → "the road's end")
  tracks how much color the world has back, in step with the on-screen
  desaturation. The three Prisms remain in the *story* (they're what the twist
  turns on — the last wild color you unknowingly carry to the Wellspring), but
  they read as beats on a road, not a checklist to fill.
- **Bosses**: the Wightoak (Ashwood), Slag the Last Flame (Emberhollow), the
  Curator (Sunken Gallery), the Warden of Hues (optional Palette Vault), and the
  two-phase finale.
- **the Pigment Press**: capture a weakened Faded, then press it into pigment or
  blend two into a Hue Charm (the engine's capture/fuse system, re-themed).

## Relationship to the engine

Built by reusing `xuanyuan/`'s engine wholesale and swapping content. The engine's
internal object keys (hero ids `auron/lyra/zephyr`, boss/dungeon ids, the
`crystals` flag) are **kept** because they're never shown to the player — only
their display names, stats, sprites, and story changed. This kept the proven
battle/save/render machinery untouched. The reforge sub-quest was dropped; three
Prisms lead straight to the Wellspring.

## Music — public-domain folk & classical

The whole score (`TRACKS` in `index.html`) is arrangements of **public-domain**
folk and classical melodies, one matched to each scene's mood — a
storybook-European palette that fits the painterly setting. Every source is
pre-1900 folk or a composer dead well over a century, so they're transcribed
directly (unlike copyrighted songs, which have to be avoided):

| scene | tune |
|---|---|
| prologue (Sable Fades) | *Londonderry Air / Danny Boy* (Irish trad.) |
| title | *Long, Long Ago* (T.H. Bayly, 1833) |
| overworld / road | *May Song* (traditional) |
| Marrow's End | *Lightly Row* (German folk) |
| Hollowmere | *Song of the Wind* (traditional) |
| Kiln Row | *Minuet in G* (Petzold) |
| the shop | *Country Gardens* (English Morris dance) |
| the Ashwood | *The Ash Grove* (Welsh trad.) |
| the Emberhollow | *Toccata in D minor* (Bach, BWV 565) |
| the Sunken Gallery | *The Water Is Wide / Waly Waly* (English trad.) |
| the Wellspring (finale) | *Canon in D* (Pachelbel, ~1690) |
| the Palette Vault | *Scarborough Fair* (English trad.) |
| generic dungeon (fallback) | *Greensleeves* (English trad., 16th c.) |
| battle | *In the Hall of the Mountain King* (Grieg, 1875) |
| boss | *Beethoven, Symphony No. 5* opening (1808) |
| visions / memory | *Go Tell Aunt Rhody* — a lament for "the old grey goose is dead" |
| ending | *Ode to Joy* (Beethoven, 1824) |

Each of the three story regions and the Wellspring now has its own theme (the
Ashwood even gets *The Ash Grove* by name); the shop and the prologue each got
one too.

## Art

The three party members are bespoke pixel sprites matching their roles: **Wren**
(teal dyer with a dye-brush), **Ochre** (ochre-robed muralist), **Cobalt**
(deep-blue lens-grinder holding a ground lens). Terrain and monster art still
carry over from `xuanyuan/` — functional, and mostly seen under the grey filter
anyway — and are the clear next art pass.

## Testing

`test/playthrough.mjs` drives the whole critical path through the real UI. As in
the sibling game, `WEAKEN=1 BUFF=22` runs it as a deterministic smoke test of the
progression chain (bosses dropped to 1hp so combat can't decide the outcome).
Needs `npm install playwright-core` (drives local Chrome).
