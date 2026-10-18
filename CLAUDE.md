# CLAUDE.md

Browser roguelike shooter in the style of The Binding of Isaac: top-down single-screen rooms, twin-stick shooting, random floors, stacking items, permadeath. Hero is **Mochi**, a sprout bun lost in a cozy-spooky haunted garden.

Source documents (read these for full detail; this file is the summary):
- `Roguelike_Game_Plan.pdf` / `.docx`: tech, code structure, build stages
- `Roguelike Game Art Direction.pdf` / `.docx`: theme, characters, enemies, projectiles, floors, boss, and image-generator prompts

## Originality rule

Everything (characters, items, art, story, names) must be original. Isaac is a genre reference only. Never copy its items, enemies, sprites, sounds or text, and avoid designs that resemble existing game characters.

## Tech stack

| Area | Choice |
|---|---|
| Engine | Phaser 3 (plain JavaScript, ES modules, no build step unless one becomes necessary) |
| Art | Pixel art made in Aseprite or Piskel; free packs (itch.io, Kenney.nl) or coloured placeholder shapes until real art exists |
| Hosting | GitHub Pages: static files only, no server code |
| Saving | `localStorage` first (unlocks, best runs); Supabase online leaderboard later |

Phaser 3.80.1 is vendored at `game/lib/phaser.min.js` (works offline, no CDN). It's loaded as a global by a classic `<script>`; game code is plain ES modules.

## Running

ES modules and JSON loading do not work from `file://`, so serve the `game/` folder:

```
cd game
npx serve .        # or: python -m http.server 8000
```

URL options: `?seed=12345` replays a run, `?debug` shows hitboxes.

## Repo and deploy

- GitHub: https://github.com/Dilfadzree98/mochi-roguelike (public; branch `main`)
- Live game: https://dilfadzree98.github.io/mochi-roguelike/
- `.github/workflows/pages.yml` publishes the `game/` folder to GitHub Pages on every push to `main`. Only files inside `game/` are served, so use paths relative to `game/index.html`.
- Design PDFs/DOCX are git-ignored and stay local.

## Code structure

Files marked *(later)* don't exist yet.

```
game/
├── index.html
├── main.js              starts Phaser (240x160, integer zoom), registers scenes
├── constants.js         room size, floor bounds, draw depths, UI tints
├── lib/phaser.min.js
├── art/
│   ├── Sprites.js       placeholder pixel art as text maps + generated tiles
│   └── PixelFont.js     3x5 bitmap font; use addText() for all text
├── scenes/
│   ├── Boot.js          loads data, builds textures and font
│   ├── Menu.js
│   ├── Game.js          main play scene: enter/leave rooms, waves, doors, pickups, win/lose
│   ├── HUD.js           hearts, wave counter, minimap; listens to Game events
│   ├── Pause.js         Esc/P overlay: resume, restart, quit (Game also pauses on window blur)
│   └── GameOver.js
├── entities/
│   ├── Player.js        Mochi; stats rebuilt from BASE_STATS + held items; coins/bombs/keys
│   ├── Enemy.js         base enemy + BEHAVIOURS registry; burn/slow status effects
│   └── Projectile.js    seeds: pierce, bounce, split, carries burn/slow
├── systems/
│   ├── Rng.js           seeded RNG, newSeed(), seedFromUrl()
│   ├── DungeonGen.js    random floor: tree of 8-12 rooms on a 7x5 grid, room types, waves
│   ├── Items.js         computeStats() (add/mul/set modifiers) and the per-run item pool
│   ├── Room.js          draws one room, its walls, door gaps and door blockers
│   ├── Fx.js            hit flash
│   └── Save.js          localStorage (best rooms cleared, wins)
└── data/
    ├── enemies.json
    └── items.json       12 items; each is a list of stat modifiers
```

Adding an item: add an entry to `data/items.json` with `modifiers` like `{ "damage": { "add": 0.5 } }`, `{ "fireDelay": { "mul": 0.75 } }` or `{ "pierce": { "set": true } }`, and an `icon` texture key (draw it in `art/Sprites.js` ICONS). A brand-new stat also needs a default in `BASE_STATS` (Player.js) and code that reads it.

Implementation patterns to keep:
- **Hitbox + sprite split:** Player and Enemy own an invisible physics `zone` (the hitbox) and a separate image that follows it. Squash/stretch scales only the image, so collisions stay stable. `hitbox.owner` points back to the entity.
- **Two RNG streams in Game:** `this.rng` for gameplay, `this.fxRng` for cosmetics (particles, animation offsets), so visual effects never change gameplay rolls.
- **Art is replaceable:** sprites are referenced by texture key only. To use real PNGs, load them in `Boot.preload` under the same keys; `makeTextures` skips keys that already exist.
- Game → HUD communication is through `Game.events` (`hp`, `wave`, `room`).
- **One room on screen at a time:** `enterRoom` builds the room from its data, `leaveRoom` finishes all tweens and destroys everything room-owned (enemies, shots, slime, `roomObjects`, room colliders). Anything that must survive leaving a room is stored on the room record in the dungeon (e.g. `room.cleared`, `room.pickups`).
- **Walls:** enemies and shots collide with a solid wall ring; the player collides with walls that have gaps at doors plus a blocker per door that is disabled when the room is cleared. Walking past the floor edge (only possible through a door gap) moves to the neighbouring room.

## Conventions

- **Data-driven content.** Items and enemies live in `data/*.json`. Adding one should not require touching game logic. Enemy behaviours are named patterns (e.g. `chase`, `ring_shot`, `charge`, `teleport_spread`) that JSON entries reference.
- **Items are small, separate modifiers.** Each item applies one stat or shot change and must stack cleanly with others. Avoid special-case code between specific items.
- **Keep rendering separate from logic** so placeholder rectangles can be swapped for sprites later without code changes beyond asset keys.
- **Pixel-perfect rendering:** `pixelArt: true`, integer zoom, no anti-aliasing or smoothing.
- **Seedable randomness:** route all run randomness (dungeon, drops, item pools) through one seeded RNG so seeded/daily runs (Stage 5) are possible later. Do not call `Math.random()` directly in gameplay code.
- Write code a solo hobby developer can read and learn from: clear names, short functions, comments only where intent is not obvious.

## Gameplay basics

- Controls: WASD to move, arrow keys to shoot in four directions, E to drop a bomb, Esc/P to pause. Gamepad and mobile touch are undecided / later.
- Room: one screen, 13×7 floor tiles of 16×16 px inside a 1-tile wall border. One door slot centred on each wall; doors lock until the room is cleared.
- Floor: grid of 8–12 rooms with boss room, treasure room and (later) shop.
- Pick-ups: hearts, coins, keys, bombs.
- Mochi's leaf shows health: perky when full, wilting when low.

## Build stages

Work in this order; don't start a stage until the previous one is playable.

1. **One room:** Mochi moves and shoots, one chasing enemy (Gloom Slug), health, damage, death. *Done (2026-10-18): endless waves in one Sunny Garden room, slime trails slow Mochi, leaf wilts at 1 heart, best wave saved.*
2. **Dungeon:** random floor generator, locking doors, minimap, boss and treasure rooms. *Done (2026-10-18): 8-12 rooms; every fight room has 2 waves (size grows with distance from start) and stays locked until both are cleared; treasure room has an empty pedestal; boss room's 2nd wave has a placeholder boss (Mother Gloom Slug, a 2x slug) and clearing it wins the run. Cleared rooms have a 40% chance to drop a heart.*
3. **Items:** 10–15 stat/shot items; hearts, coins, keys, bombs. *Done (2026-10-18): 12 items (5 seed types + 7 stat items), treasure room locked with a key and holds an item, new shop room (worm shopkeeper: item 5, heart/bomb/key 3 coins), bombs on E (5 damage, also hurt Mochi), coins drop from enemies, room-clear drops weighted by luck. Mochi starts with 1 bomb and 1 key.*
4. **Variety and polish:** *Next.* More enemies, 2–3 bosses, multiple floors, sound, music, screen shake, title screen, unlockable characters.
5. **Extras (optional):** seeded runs, daily challenge, online leaderboard, mobile touch controls.

Suggested v1.0 scope: 1 character, 3 floors, 20 items, 3 bosses (not final).

## Art direction summary

Cute but slightly creepy pixel art. A soft, warm hero in a world that grows darker the deeper you go. No gore.

- Sprites 16×16 (gnome 16×24, boss 48×48, portraits 64×64, boss intro card 96×96). Shots 6×6 to 8×8.
- 1-px outline in a darker shade of the fill, never pure black. Cel shading: one highlight, one shadow, no gradients.
- One fixed palette of 16–32 colours across the whole game.
- **Readability rules (gameplay-critical):** player is warm (peach and green); enemies use cool or muted colours; **every enemy bullet is hot pink `#E0457B`** (outline `#8A1E47`, core `#FFC2D6`) and nothing else uses that colour; floors are dark and low-contrast; decorations must never look like enemies or bullets.

### Key colours

| Thing | Colours |
|---|---|
| Mochi body | fill `#FFD8C2`, outline `#D99579`; ears `#FFD3BA` / inner `#F7AEC0`; leaves `#8BC86A` / `#A6D987`, stem `#5E9C3A`; eyes `#2C2C2A`; blush `#F59AB0` @65% |
| Player seed shot | fill `#8BC86A`, outline `#3F7A2A`, shine `#FFFFFF` |
| Enemy bullets | fill `#E0457B`, outline `#8A1E47`, core `#FFC2D6` |

### Enemies

| Enemy | Floor | Behaviour |
|---|---|---|
| Gloom Slug | 1 | Crawls toward player, slime trail slows Mochi |
| Grumpshroom | 1 | Stationary; ring of 8 spore bullets every 2 s |
| Click Beetle | 2 | Pauses, wiggles warning, charges straight until it hits a wall |
| Thornvine | 2–3 | Stationary; bud opens and fires 3 aimed thorns |
| Hexed Gnome | 3–4 | Mini-elite; teleports, freezes 1 s, fires 3-way spread |

### Shot items

Fire Seed (burn DoT), Frost Seed (slow), Bouncing Pollen (bounces 3×), Dewdrop (pierces), Thorn Seed (splits into 3 on hit).

### Floors (getting darker)

1. Sunny Garden: floor `#5F8A4A`, wall `#3A5A2C`, accent `#F2C94C`
2. Dim Greenhouse: floor `#5C6B5E`, wall `#3B4A45`, accent `#9FD8C8`
3. Mushroom Cellar: floor `#4A3B35`, wall `#2E2424`, accent `#6FD3FF`
4. Compost Depths: floor `#3A2E3F`, wall `#1F1A24`, accent `#B57BFF`

### Final boss: The Weed Queen

Three phases (100–66%, 66–33%, 33–0%): vine sweeps and slow pink seed rings; then summons 2 Gloom Slugs and roots erupt under the player after a warning crack; then a pink bullet spiral and faster sweeps. 0.5 s glowing windup before every attack.

### Game feel

White 1-frame hit flash on all enemies, slight screen shake on big hits, particle bursts (leaves, husks) on death, squash-and-stretch on Mochi's movement, soft dark vignette at room edges.

## Open decisions

- Theme: haunted garden (recommended, assumed default) vs Malaysian folklore (kampung / rumah kayu, cute toyol and pocong). Confirm before producing lots of theme-specific content.
- Controls beyond keyboard.
- Final v1.0 scope.
