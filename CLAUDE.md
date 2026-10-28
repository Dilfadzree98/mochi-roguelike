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
- Visitor stats: GoatCounter (free, no cookies), dashboard https://mochi-roguelike.goatcounter.com. The script tag in `index.html` counts visits; `track(path)` in `systems/Analytics.js` counts game events (`run/start/<character>`, `run/reached-floor-<n>`, `run/died-on-floor-<n>`, `run/won`). Visits from localhost aren't counted.

## Code structure

```
game/
├── index.html
├── main.js              starts Phaser (480x272, integer zoom), registers scenes
├── constants.js         room size, floor bounds, draw depths, UI tints
├── lib/phaser.min.js
├── art/
│   ├── Sprites.js       makeTextures(): builds every texture at boot from the modules below
│   ├── Pixels.js        software canvas: shapes, `inside` shading, auto 2px outline, crop; paint()
│   ├── Characters.js    Mochi + outfits (Mangkok, Lilo) and all their variants; Chinggu
│   ├── Enemies.js       the first 5 enemies, bosses (size-factor designs), pink enemy bullets
│   ├── Critters.js      the 28 later enemies and their extra frames (mole mound, hiding shells, rolled pill bug, open flytrap)
│   ├── Items.js         shots, all item icons, pickups, hearts, skill icons
│   ├── World.js         floor/wall tiles and wall faces, doors, obstacles, decorations, particles
│   └── PixelFont.js     3x5 bitmap font drawn at 2x by default, CAPITALS ONLY; use addText() (it uppercases); uppercase before setText()
├── scenes/
│   ├── Boot.js          loads data, builds textures and font
│   ├── Menu.js
│   ├── CharacterSelect.js  pick Mangkok Mochi or Lilo Mochi (remembers last pick)
│   ├── Game.js          main play scene: floors, rooms, waves, doors, pickups, tooltips, enemy bullets, win/lose
│   ├── HUD.js           hearts, counters, wave/floor, minimap, boss health bar; listens to Game events
│   ├── Pause.js         Esc/P overlay: resume, restart, quit (Game also pauses on window blur)
│   └── GameOver.js
├── entities/
│   ├── Player.js        Mochi; stats rebuilt from BASE_STATS + held items; coins/bombs/keys
│   ├── Enemy.js         base enemy, BEHAVIOURS registry, DEATHS animations, burn/slow
│   ├── BossMoves.js     the 7 bosses' moves (generators), idle patterns, enrage
│   ├── EnemyBullet.js   pink enemy bullets
│   └── Projectile.js    seeds: pierce, bounce, split, carries burn/slow
├── systems/
│   ├── Rng.js           seeded RNG, newSeed(), seedFromUrl()
│   ├── DungeonGen.js    random floor: tree of 8-12 (+1 per floor) rooms on a 7x5 grid, room types, waves
│   ├── Audio.js         Web Audio synth: sound effects + one generated tune per floor; M mutes
│   ├── Pathing.js       13x7 floor grid: flow-field pathfinding, line-of-sight, obstacle layouts
│   ├── Skills.js        character skills: Burger Beam, Spawn Chinggu (cat ally); HUD 'skill' event
│   ├── Items.js         computeStats() (add/mul/set modifiers) and the per-run item pool
│   ├── Room.js          draws one room, its walls, door gaps and door blockers
│   ├── Fx.js            hit flash
│   ├── Save.js          localStorage (best floor, rooms cleared, wins)
│   ├── HeldKeys.js      isHeld(keyCode): keys physically held, tracked on the window (survives pausing)
│   └── Analytics.js     track(): game events for the GoatCounter dashboard
└── data/
    ├── characters.json  playable characters: name, description, texture, stat modifiers, skill
    ├── enemies.json     33 enemies, 7 bosses and 10 mini bosses: stats, behaviour + params, difficulty + weight, onDeath (bosses: idle + 3 moves)
    ├── floors.json      4 floors: palette, wall face, decorations, obstacles
    └── items.json       69 items, each with a tier (1-4) and a list of stat modifiers
```

Adding an enemy: add an entry to `data/enemies.json` using an existing `behaviour` (`chase`, `ring_shooter`, `charger`, `aimed_shooter`, `teleporter`, `wander`, `kiter`, `flutter`, `burrower`, `hopper`, `shell`, `dasher`, `spinner`, `wisp`, `drifter`, `roller`, `slasher`, `mortar`, `summoner`, `snapper`, `stalker`) with its `params`, a `death` from `DEATHS`, a `difficulty` (1-4) and a `weight` (how common), and a sprite in `art/Critters.js`. Optional: `"flying": true` (passes over obstacles), `onDeath` (`ring` of bullets or `spawn` { type, count }), `maxPerWave`. A new movement pattern goes in `BEHAVIOURS` in Enemy.js. Enemy attacks use Game's `fireRing` / `fireSpread` / `fireSpiral` / `fireSweep` / `rootStrike` / `markStrike`.

Adding a boss: an entry in `data/enemies.json` with `"boss": true`, `"behaviour": "boss"`, an `idle` (`still`, `chase`, `wander`), three `moves` and `params.cooldownMs`. Moves are generators in `BOSS_MOVES` (entities/BossMoves.js): `yield ms` waits, a bare `yield` waits one frame. It joins the boss pool automatically.

Adding an item: add an entry to `data/items.json` with `modifiers` like `{ "damage": { "add": 0.5 } }`, `{ "fireDelay": { "mul": 0.75 } }` or `{ "pierce": { "set": true } }`, a `tier` (1 = weak or with a downside, 2 = mid, 3 = good, 4 = best) and an `icon` texture key (draw it in `art/Items.js` ICONS, or for a shot item add it to SHOT_ITEM_ICONS and its shot to SHOTS). A brand-new stat also needs a default in `BASE_STATS` (Player.js) and code that reads it.

Implementation patterns to keep:
- **Hitbox + sprite split:** Player and Enemy own an invisible physics `zone` (the hitbox) and a separate image that follows it. Squash/stretch scales only the image, so collisions stay stable. `hitbox.owner` points back to the entity.
- **Two RNG streams in Game:** `this.rng` for gameplay, `this.fxRng` for cosmetics (particles, animation offsets), so visual effects never change gameplay rolls.
- **Art is replaceable:** sprites are referenced by texture key only. To use real PNGs, load them in `Boot.preload` under the same keys; `makeTextures` skips keys that already exist.
- Game → HUD communication is through `Game.events` (`hp`, `wave`, `room`, `inventory`, `floor`, `boss`).
- **Floors:** `startFloor(i)` makes a new dungeon from `floors.json[i]`; the player, items and item pool carry over. Beating a boss on floors 1-3 leaves an item pedestal and a trapdoor (`descend()`); beating floor 4's boss wins.
- **Bosses:** 7 bosses, 3 moves each (BossMoves.js). At run start `Game.bossOrder` shuffles every boss id, and floor *i* gets `bossOrder[i]`, so any boss can be on any floor and none repeats in a run. A boss room has no waves: `room.waves` is `[[bossId]]` and the HUD shows FLOOR, not WAVE. Boss HP is `hp` x `BOSS_HP_BY_FLOOR` ([1, 1.5, 2.1, 2.8]). After each move the boss rests for `cooldownMs` (1.7-1.8 s; the first move comes 1.6 s into the fight) and then picks a different move. Below 50% HP it is enraged: pink tint, a banner, 0.75x rest time and stronger moves (`e.ai.enraged`). Bosses ignore knockback and Catnip. A boss charge (dash, roll, hop) can't be stopped by obstacles: it goes through them and breaks every one it touches (`smash()` and `ai.smashing` in BossMoves.js); only walls stop it. Boss charge speeds and warnings: Slime Dash 190 px/s (240 enraged) after 0.9 s, Triple Charge 270 after 0.6 s each, Rolling Bounce 185 (225) after 0.8 s, Hop Slam 150 after 0.55 s.
- **Warning sound:** every attack warning plays `warn` (a two-note alert): `Enemy.windup()` (glow), `Enemy.shake()` (shake before a charge or dash), Thornvine's bud opening, `markStrike` targets and `rootStrike` cracks. It's limited to once per 150 ms (`SFX_GAPS` in Audio.js) so a crowd doesn't spam it. Killing one kills its summons.
- **Drops** (constants at the top of Game.js): a regular enemy has a 10% chance (+3% per luck) to drop a coin. A cleared fight room has a 50% chance (+15% per luck) of one drop: coin 40 / heart 30 / bomb 15 / key 15. A beaten boss (floors 1-3) drops a heart, or two hearts 40% of the time, below its item and trapdoor.
- **Enemy bullet range:** regular shooters' bullets pop after `params.range` px (Grumpshroom 64, Thornvine 96, Hexed Gnome 88), so they can't hit Mochi from across the room. Boss bullets have no range limit.
- **Bombs:** E drops one at Mochi's feet (2 s fuse, 60 px blast that hurts enemies and Mochi and breaks obstacles). Once Mochi has stepped off it, walking into it kicks it 100 px (`kickBomb`), and shooting it pushes it 50 px in the shot's direction (`shootBomb`; the shot pops unless it pierces). Distances are `BOMB_KICK_DISTANCE` / `BOMB_SHOT_DISTANCE`; the start speed is worked out from `BOMB_DRAG`, which `updateBombs` applies evenly in every direction. Bombs bounce off walls and obstacles and stop when they reach an enemy. A bomb is a hitbox zone in `bombBodies` plus an image that follows it, like enemies.
- **Stats panel:** on the left side below the left door (`STAT_LINES` in HUD.js): Damage, Fire rate (shots per second, from `fireDelay`), Shot speed, Range, Speed, Luck, as raw stat values. A change flashes green (up) or red (down); the HUD redraws on the `stats` event that `Player.addItem` emits. **I** or the pause menu's "Stats: On/Off" toggles it (`Game.toggleStats`); the choice is saved (`Save.showStats`, on by default).
- **Mochi's invincibility:** 2 s after each hit (`INVULN_MS` in Player.js), with blinking.
- **Input feel:** an arrow tapped during the reload is remembered (`Player.queuedFire`) and fires when the reload ends; taps during the Burger Beam are dropped. Movement eases to full speed in about 80 ms (`ACCEL` 28). Phaser resets every key when the Game scene pauses, so on resume `Game` marks keys that are still physically held (`isHeld` from HeldKeys.js) as down again.
- **Characters:** Mangkok Mochi (boy, blue cap with a burger on it) and Lilo Mochi (girl, pink flower on her right ear, eyelashes). Each has stat `modifiers` in characters.json, applied like an item (Mangkok: damage +0.25, speed -6; Lilo: speed +8). The select screen shows hearts plus Damage/Speed/Fire rate as 1-5 pips (3 = base Mochi; `STAT_ROWS` in CharacterSelect.js).
- **Skills** (systems/Skills.js): every `skill.every` (30) shots charge the character's skill. When it's ready (a sound, a "ready - Space" hint and a blinking meter), **Space** casts it (`Skills.tryCast`) for `skill.durationMs` (2 s). It stays charged until used, even between rooms. Shots don't charge it while it's ready or running. **Burger Beam** (Mangkok): a beam in the facing direction that stops at walls and burns through obstacles (each breaks after 2 ticks / 0.2 s, via `Game.breakObstacle`, same as bombs), damages every enemy it overlaps (0.6 x damage per 100 ms tick), pops enemy bullets, slows Mochi, and replaces normal shots. **Spawn Chinggu** (Lilo, 4 s): Chinggu, a calico cat (white with orange and black patches, pink bow), appears next to Lilo, runs to the nearest enemy using `Game.pathAngle()` and scratches it (1.5 x damage every 450 ms); with no enemies she follows Lilo. Enemies ignore her and she can't be hurt. The HUD meter (icon + bar) fills per shot, blinks when ready and drains while active. Skills stop when leaving a room or dying. Their sprites are base Mochi plus an outfit drawn on top (`OUTFITS` in art/Characters.js; `makeCharacter` builds `<key>`, `_hurt`, `_wilt`, `_wilt_hurt`, `_bare`). The sprout leaf stays visible on both because it shows health. The character id travels Select → Game → GameOver/Pause restart. Adding one: an outfit in `OUTFITS` + an entry in `characters.json` (keep descriptions ≤ 22 characters so the two cards don't overlap).
- **Tooltips:** any pickup spot created with an `info` ({ name, description }) shows a tooltip when Mochi is within 48 px: a small panel in the bottom-left corner of the room with the name at normal size and the description at half size (font scale 1).
- **Enemy types per room:** every enemy has a `difficulty` (1-4). Floor N may use difficulties N-2 to N, weighted ×3 for N, ×2 for N-1, ×1 for N-2, times each enemy's `weight` (`floorPool` in DungeonGen.js). Each fight room then picks its own 2-4 types from that pool, always including one of the floor's own difficulty (`pickRoomTypes`), and its waves use only those. So neighbouring rooms have different enemies, deeper floors are harder, and any enemy can be missing from a run. Regular enemies also get +20% health and +8% speed per floor (`speedScale` in Enemy.js).
- **Room sizes:** `ROOM_SIZES` in constants.js: normal 13x7 floor tiles (one screen), wide 21x7, tall 13x11, big 21x11. 35% of fight rooms are bigger (wide 4 : tall 3 : big 2); start, treasure, shop and boss rooms are always normal. A room stores `shape` and `size`; `enterRoom` calls `setRoomSize`, which updates the shared `ROOM` (tiles) and `FLOOR` (pixel bounds) that walls, doors (always mid-wall), pathing, spawns and shots read. The camera follows Mochi within the room (`setBounds` + `startFollow`; one-screen rooms don't scroll). Banners and the item panel use `setScrollFactor(0)`. Bigger rooms get more obstacles (scatter scaled by area), more decorations and bigger waves (`WAVE_BONUS`: wide/tall up to 8 enemies, big up to 9). Vignettes are made per room size (`roomVignette`).
- **Enemy states that matter to Game:** `enemy.untouchable` (mole underground, faded wisp: shots pass through, touching doesn't hurt), `enemy.ai.armored` (snail in its shell: hits glance off), `enemy.passesObstacles` (flying, or underground: the obstacle collider skips it). A boss's death sets `Game.clearingMinions` so dying minions don't split or burst.
- **Waves:** `makeWave` in DungeonGen.js: each wave is 1-6 enemies of 1-3 types (weights `TYPES_PER_WAVE`), types drawn from the floor's roster without repeats; the minimum size grows with distance from start + floor; `maxPerWave` in enemies.json caps strong enemies (gnome 2, thornvine/grumpshroom 3, beetle 4).
- **Obstacles:** each fight room gets a mirrored layout (`makeLayout` in Pathing.js) of whole-tile obstacles from the floor's `obstacles` list (20% of fight rooms are open; boss rooms get one of 6 cover patterns (`BOSS_SHAPES` in Pathing.js) or, 25% of the time, nothing; start/treasure/shop stay empty). Layouts never block door entrances and always keep every free tile reachable. Obstacles block Mochi, enemies and all bullets; bombs and the Burger Beam break them (`room.obstacles[].broken` persists); `"hurts": true` (thorn clusters) damages Mochi on touch. Chasing enemies use `Game.chaseAngle()` (straight line if clear, else flow field). Spawns, teleports and drops use `areaFree` / `freeSpot` to avoid obstacles.
- **One room on screen at a time:** `enterRoom` builds the room from its data, `leaveRoom` finishes all tweens and destroys everything room-owned (enemies, shots, slime, `roomObjects`, room colliders). Anything that must survive leaving a room is stored on the room record in the dungeon (e.g. `room.cleared`, `room.pickups`).
- **Walls:** enemies and shots collide with a solid wall ring; the player collides with walls that have gaps at doors plus a blocker per door that is disabled when the room is cleared. Walking past the floor edge (only possible through a door gap) moves to the neighbouring room.

## Conventions

- **Data-driven content.** Items, enemies and floors live in `data/*.json`. Adding one should not require touching game logic. Enemy behaviours are named patterns in Enemy.js that JSON entries reference.
- **Items are small, separate modifiers.** Each item applies one stat or shot change and must stack cleanly with others. Avoid special-case code between specific items.
- **Keep rendering separate from logic** so placeholder rectangles can be swapped for sprites later without code changes beyond asset keys.
- **Pixel-perfect rendering:** `pixelArt: true`, integer zoom, no anti-aliasing or smoothing.
- **Resolution and units:** the game is 480x272. Every coordinate, speed (px/s), range, radius and hitbox in the code and JSON is in these screen pixels (they were all doubled when the game moved up from 240x160). Tiles are 32 px; the room is 15x9 tiles (480x288), so `ROOM_Y` is -8 and the top and bottom walls are cut by 8 px; the HUD (`HUD_HEIGHT` 24) sits over the top wall, with no backing bar and nothing in the middle, so the top door stays visible: hearts on the left, skill meter and wave/floor on the right, coin/bomb/key counters stacked under the hearts. The minimap (top-right, 40% opacity) and a big map shown while **Tab** is held are drawn by `HUD.drawMap`; each room is drawn in its real shape (wide rooms wider, tall rooms taller), centred in its grid cell. Special rooms show a pixel icon (`map_<type>` textures from art/MapIcons.js, drawn as 7x7 character grids with a 1 px outline): boss = horned purple skull, mini boss = skull with red eyes, treasure = crown, shop = coin purse, sacrifice = blood drop, secret = question mark. Icons are 1x on the minimap (70% opacity) and 2x on the big map, whose legend uses them too. The boss bar sits over the bottom wall.
- **Art style in code:** every sprite is painted at boot with `paint()` (art/Pixels.js): simple shapes, shading with `inside()`, then an automatic 2 px dark outline, cropped so feet are on the texture's bottom edge. Characters are about 40x40, regular enemies 24-48 px, bosses 56-100 px (drawn at full size, never scaled up, so outlines stay 2 px), shots 10 px + outline, item icons 24 px + outline. Particles and floor decorations have no outline and use 2x2 blocks (`blocks()` in World.js). Text is the 3x5 font at scale 2 (titles 4 or 8). Never use `setScale` to enlarge in-game sprites; menus show characters at 2x.
- **Seedable randomness:** route all run randomness (dungeon, drops, item pools) through one seeded RNG so seeded/daily runs (Stage 5) are possible later. Do not call `Math.random()` directly in gameplay code.
- Write code a solo hobby developer can read and learn from: clear names, short functions, comments only where intent is not obvious.

## Gameplay basics

- Controls: WASD to move, arrow keys to shoot in four directions, E to drop a bomb, Space for the skill, hold Tab for the map, I to show/hide stats, Esc/P to pause, M to mute. Gamepad and mobile touch are undecided / later.
- Room: one screen, 13×7 floor tiles of 32×32 px inside a 1-tile wall border. One door slot centred on each wall; doors lock until the room is cleared.
- Run: 4 floors, each a grid of 11–18 rooms: start, fight rooms, treasure (key-locked; 3 items, take one, the other two go back into the pool), shop, sacrifice, mini boss, boss, and a hidden secret room. Treasure, shop, sacrifice and mini boss rooms take dead ends (`tryGenerate` needs at least 5).
- **Chests:** a room-clear drop can be a chest (`ROOM_DROP_WEIGHTS`); walking into it spills 2-4 mixed coins, hearts, bombs and keys (`openChest`).
- **Sacrifice room:** an altar of spikes in the middle. Each step onto it (step off and back on to go again: pickup spots with `rearm`) costs a full heart and has a 35% chance of an item, +20% per failed try (max 90%), resetting after an item. It will take your last heart too, which kills you (no warning); at most 2 items (`SACRIFICE` in Game.js). Items appear on pedestals beside the altar and are remembered in `room.contents.pedestals`.
- **Secret room:** one per floor, in an empty grid cell next to a normal/start/shop/sacrifice room and never next to the boss or mini boss room (`addSecretRoom` in DungeonGen.js). Its host room has `secretDoor`: that wall shows a crack (`wall_crack`) and stays solid until a bomb blast reaches it (`revealSecret`, which swaps in new player walls). Door slots are always kept free of obstacles. The secret room isn't on the map until revealed. Inside: 40% an item, else 3-5 drops (maybe a chest).
- **Mini boss room:** optional, behind a skull door (`door_miniboss`). Walking within 72 px of that door (until the room is beaten) shows a red "Danger: mini bosses!" panel in the tooltip spot and plays `warn` (`doorWarnings`, `MINI_BOSS_WARNING` in Game.js). Entering locks you in for 2 waves, one random mini boss each (two different ones); beating both leaves a random item. Mini bosses are `"boss": true, "mini": true` in enemies.json (boss bar, boss HP scaling, 2 boss moves each) and never appear as floor bosses. Their sprites are regular enemies drawn 1.5-3.2x bigger with a crown (`paintScaled` in Pixels.js, `MINI_BOSSES` in Critters.js).
- **Shop restock:** bump into the worm to pay for new goods (a new item, heart, bomb and key; the unsold item goes back into the pool). The price is random and rises with the floor (`RESTOCK_PRICES`: 3-6, 5-9, 7-12, 9-15 coins) and is rerolled after each restock.
- **Item tiers:** every item has `tier` 1–4. Items are drawn from the run's pool by tier first (`drawItem` in Items.js): treasure rooms and the shop use `TIER_WEIGHTS.normal` (30/35/25/10 %), the item a boss leaves uses `TIER_WEIGHTS.boss` (0/20/50/30 %). Tiers are hidden from the player: no tier text or colours anywhere; they only change how often items show up.
- **Skill upgrades:** only for beating a boss (floors 1–3) without losing any health (`Game.bossNoHit`, cleared by any hit that costs health; a Ladybug block doesn't count). Then two orbs appear above the item ("Upgrade your skill"); taking one makes the other vanish (`offerSkillUpgrades`, remembered in `room.contents.upgradeTaken`). The options are the skill's `upgrades` in characters.json, which add to `Skills.bonus`: Burger Beam = Longer Beam (+1 s) or Stronger Beam (+50% beam damage, `bonus.beamDamage`); Chinggu = Another Chinggu (one more cat each cast; cats go for different enemies) or Chinggu Stays Longer (+2 s). Upgrades stack across the run.
- Pick-ups: hearts, coins, keys, bombs.
- Mochi's leaf shows health: perky when full, wilting when low.

## Build stages

Work in this order; don't start a stage until the previous one is playable.

1. **One room:** Mochi moves and shoots, one chasing enemy (Gloom Slug), health, damage, death. *Done (2026-10-18): endless waves in one Sunny Garden room, slime trails slow Mochi, leaf wilts at 1 heart, best wave saved.*
2. **Dungeon:** random floor generator, locking doors, minimap, boss and treasure rooms. *Done (2026-10-18): 8-12 rooms; every fight room has 2 waves (size grows with distance from start) and stays locked until both are cleared; treasure room has an empty pedestal; boss room's 2nd wave has a placeholder boss (Mother Gloom Slug, a 2x slug) and clearing it wins the run. Cleared rooms have a 40% chance to drop a heart.*
3. **Items:** 10–15 stat/shot items; hearts, coins, keys, bombs. *Done (2026-10-18): 12 items (5 seed types + 7 stat items), treasure room locked with a key and holds an item, new shop room (worm shopkeeper: item 5, heart/bomb/key 3 coins), bombs on E (5 damage, also hurt Mochi), coins drop from enemies, room-clear drops weighted by luck. Mochi starts with 1 bomb and 1 key.*
4. **Variety and polish:** more enemies, 2–3 bosses, multiple floors, sound, music, screen shake, title screen, unlockable characters. *Mostly done (2026-10-18): 4 floors (Sunny Garden, Dim Greenhouse, Mushroom Cellar, Compost Depths) with their own tiles, decorations and enemy mix; enemies Grumpshroom, Click Beetle, Thornvine, Hexed Gnome; bosses Mother Gloom Slug, Grandshroom, Gnome King and the 3-phase Weed Queen, with health bar; regular enemies +20% HP per floor; synthesized SFX and per-floor music; item/ware tooltips. Character select added 2026-10-19 (Mangkok Mochi, Lilo Mochi; same stats, not unlockable). Not done: unlockable characters, a fancier title screen.*
5. **Extras (optional):** seeded runs, daily challenge, online leaderboard, mobile touch controls.

Suggested v1.0 scope: 1 character, 3 floors, 20 items, 3 bosses (not final).

## Art direction summary

Cute but slightly creepy pixel art. A soft, warm hero in a world that grows darker the deeper you go. No gore.

- Screen 480×272. Characters and items designed around 40×40 (worked on a 64×64 canvas); regular enemies about 24–48 px, bosses up to about 100 px. Shots about 10–14 px.
- 2-px outline in a very dark shade, never pure black (Mochi's is dark brown). Cel shading: one highlight, one shadow, no gradients.
- One fixed palette of 16–32 colours across the whole game.
- **Readability rules (gameplay-critical):** player is warm (peach and green); enemies use cool or muted colours; **every enemy bullet is hot pink `#E0457B`** (outline `#8A1E47`, core `#FFC2D6`) and nothing else uses that colour; floors are dark and low-contrast; decorations must never look like enemies or bullets.

### Key colours

| Thing | Colours |
|---|---|
| Mochi body | fill `#FFD8C2`, outline `#D99579`; ears `#FFD3BA` / inner `#F7AEC0`; leaves `#8BC86A` / `#A6D987`, stem `#5E9C3A`; eyes `#2C2C2A`; blush `#F59AB0` @65% |
| Player seed shot | fill `#8BC86A`, outline `#3F7A2A`, shine `#FFFFFF` |
| Enemy bullets | fill `#E0457B`, outline `#8A1E47`, core `#FFC2D6` |

### Enemies

33 enemies; each fight room uses a random 2–4 types, harder ones deeper down (difficulty 1 on floor 1; 1–2 on floor 2; 1–3 on floor 3; 2–4 on floor 4).

| Enemy | Difficulty | HP | Behaviour |
|---|---|---|---|
| Gloom Slug | 1 | 4 | Crawls after Mochi, slime trail slows Mochi |
| Grumpshroom | 1 | 5 | Stationary; ring of 8 spores every 2 s |
| Click Beetle | 2 | 6 | Wanders, wiggles, charges until it hits something |
| Thornvine | 3 | 7 | Stationary; bud opens and fires 3 aimed thorns |
| Hexed Gnome | 4 | 9 | Fires a 3-way spread, fades, teleports |
| Bramble Mite | 1 | 2 | Tiny, fast chaser |
| Puffball | 1 | 5 | Drifts about; bursts into 8 spores when killed |
| Acorn Weevil | 2 | 5 | Keeps its distance, circles, stops to fire a fast single shot |
| Dusk Moth | 1 | 4 | Flies (over obstacles) in a wobbly line, drops a ring of 4 spores |
| Mole | 3 | 7 | Tunnels as a mound (can't be hit), pops up and fires a ring of 6 |
| Garden Spider | 2 | 5 | Crouches, then leaps at Mochi |
| Shell Snail | 1 | 8 | Slow chaser; hides in its shell (shots glance off) |
| Wasp | 3 | 4 | Flies circles around Mochi, then dashes straight at them |
| Toad | 2 | 8 | Hops at Mochi; every landing puffs a ring of 6 |
| Sunflower Sentry | 4 | 10 | Stationary; sprays a turning 2-arm stream, then rests |
| Wisp | 4 | 5 | Floats through obstacles, fades out (can't hurt or be hurt) |
| Rot Worm | 1 | 6 | Chaser; splits into 2 Bramble Mites when killed |
| Aphid | 1 | 1 | Tiny, fast chaser |
| Fluff Drifter | 1 | 3 | Floats about (flying), puffs single slow spores |
| Pill Bug | 1 | 5 | Crawls; curls into a ball and rolls fast, bouncing off walls |
| Sprout Spitter | 1 | 4 | Stationary; small ring of 4 seeds |
| Firefly | 2 | 4 | Flies in a wobbly line, drops rings of 3 seeds |
| Mantis | 2 | 7 | Stalks close, raises its arms, lunges and slashes a fan of 3 thorns |
| Grasshopper | 2 | 5 | Long, fast leaps at Mochi |
| Tulip Mortar | 2 | 7 | Stationary; lobs a seed onto a target mark under Mochi that splashes into 6 spores |
| Stag Beetle | 3 | 10 | Faster, tougher charger |
| Garden Bat | 3 | 6 | Flies circles, swoops at Mochi and bursts into a ring of 6 |
| Scarecrow | 3 | 12 | Stationary; calls up to 4 Bramble Mites and fires 3 thorns |
| Thorn Turtle | 3 | 12 | Hides in its shell (shots glance off); comes out with a ring of 8 thorns |
| Venus Flytrap | 4 | 14 | Stationary; snaps (70 px) when Mochi comes within 80 px, else fires 5 thorns |
| Lantern Spirit | 4 | 11 | Teleports, fires 5 hex orbs and a ring of 8 every time |
| Shadow Fox | 4 | 9 | Creeps nearly invisible, appears and lunges when close |
| Wasp Nest | 4 | 16 | Stationary; sends out Wasps (up to 3) |

Mini bosses (10; two different ones per mini boss room): Aphid Queen (swarm of aphids, spore rings), Puffball Elder (spore spiral, hex curse marks), Mantis Duelist (triple charge, thorn volley), Bullfrog (hop slam, spore rings), Stag Lord (triple charge, shell shrapnel), Moth Matriarch (flying; spore spiral, hex nova), Turtle Elder (shell shrapnel, rolling bounce), Scarecrow Lord (vine sweep, root strike), Lantern Wraith (blink volley, hex nova), Shadow Alpha (triple charge, burrow).

Bosses (7; one random boss per floor, never the same one twice in a run):

| Boss | Idle | Moves |
|---|---|---|
| Mother Gloom Slug | chases | Slime Dash (charge, thick slime), Brood (2-3 baby slugs), Goo Rain (blobs land on target marks and splash) |
| Grandshroom | still | Hop Slam (2-3 hops, spore ring on landing), Spore Rings, Spore Spiral |
| The Gnome King | still | Blink Volley (teleport + 7-way fan), Hex Nova (3 rings), Hex Curse (marks around Mochi burst into orbs) |
| The Weed Queen | rooted at top | Vine Sweep, Root Strike (roots under Mochi, 3-5 times), Thorn Volley (3 aimed fans) |
| Beetle Baron | wanders | Triple Charge, Shell Shrapnel (2 rings), Burrow (crack follows Mochi, bursts out) |
| Bramble Hydra | rooted at top | Triple Spit (each head fires a fan), Bramble Wall (row of thorns with a gap), Thorn Rain |
| Pumpkin King | chases | Rolling Bounce (bounces off walls), Seed Stream, Star Burst (8-way rings) |

### Items (37)

- **Shot items (20):** Fire Seed (burn), Frost Seed (slow), Bouncing Pollen (bounces 3x off walls and obstacles), Dewdrop (pierce), Thorn Seed (split in 3), Homing Spore (homing), Pumpkin Seed (big shots), Wiggle Vine (wave), Boomerang Leaf (returns), Dandelion Puff (fan of seeds), Hedgehog Seed (back shot), Popcorn Kernel (splash), Nightshade Berry (poison), Static Thistle (chain zap), Acorn (knockback), Sprinkler Head (ring every 6th shot), Rocket Radish (accelerating shots), Catnip (dizzy enemies; bosses immune), Golden Kernel (15% triple damage), Ghost Pepper (through obstacles).
- **Stat items (17):** Bone Meal, Sun Drop, Watering Can, Bee Wings, Big Leaf, Twin Sprout, Lucky Clover, Honey Pot, Morning Dew, Garden Gloves, Snail Shell, Grasshopper Legs, Fertilizer Bag, Scarecrow Hat, Piggy Bank, Sweet Nectar, Cactus Water.
- **Newer items (20):**
  - Tier 1, with a downside: Rusty Trowel (+damage, slower shots), Wilted Rose (−1 heart, +damage), Cursed Seed (×1.3 damage, enemies ×1.3 health), Soggy Bread (+1 heart, much slower), Weed Killer (poison, shorter range), Bad Luck Penny (10 coins, −1 luck).
  - Tier 2: Garden Hose (shot speed and range), Pine Cone (damage, knockback), Ladybug (blocks the first hit in each room), Compost Heap (heal half a heart every 12 kills), Worm Jar (3 bombs, blasts ×1.5), Rose Thorns (enemies touching Mochi take 4 damage).
  - Tier 3: Sun Hat (fire rate, range), Queen Bee (damage, homing), Golden Watering Can (heart, full heal, damage), Dragonfly Wings (speed, shot speed, +0.5 s invincibility), Pitchfork (bosses take ×1.5 damage).
  - Tier 4: Sunflower Heart (+2 hearts, full heal, damage, fire rate), Thunder Seed (piercing shots that chain-zap twice), World Tree Sap (extra seed, ×1.25 damage, fire rate, range).
- **Shot items always come with a stat change too** (up or down, said in the description): e.g. Fire Seed burns but shots fly slower, Dewdrop pierces and shots fly faster.
- **Third batch of shot items (12):** Firework Seed (bursts into 6 at the end of its range; −range), Magic Bean (shots grow to 2x size and damage; −shot speed), Lightning Bug (zigzag; faster fire), Spiral Shell (spiral outward; +damage), Frost Mint (20% chance to freeze a non-boss enemy 1 s; +speed), Vampire Beet (heal half a heart every 25 hits; slower fire), Pinball Pea (bounces on to 2 more enemies; +damage), Burr Mine (every 5th shot drops a mine that bursts near enemies; +luck), Sleepy Seed (pauses, then darts at the nearest enemy; +damage), Watermelon Seed (every 4th shot huge, 3x damage; −speed), Pea Pod (bursts of 3 weaker peas; slower fire), Blast Berry (killed enemies explode for 2 damage; faster shots). Stats: `expireBurst`, `growing`, `zigzag`, `spiral`, `stun`, `leechEvery`, `ricochet`, `mineEvery`, `lurk`, `bigEvery`, `burst`, `killBlast`.
- Item stats added for these: `enemyHp`, `roomShield`, `healEvery`, `bombPower`, `thorns`, `invulnBonus`, `bossDamage` (defaults in `BASE_STATS`). `maxHp` never drops below 1 heart.
- `onPickup` supports `heal`, `healFull`, `coins`, `bombs`, `keys`. Shot behaviour stats and their defaults are in `BASE_STATS` (Player.js); caps in `LIMITS` (Items.js). Shots steer by angle each frame in `Projectile.steer()` so homing/wave/accelerate/boomerang combine.

### Floors (getting darker)

1. Sunny Garden: floor `#5F8A4A`, wall `#3A5A2C`, accent `#F2C94C`
2. Dim Greenhouse: floor `#5C6B5E`, wall `#3B4A45`, accent `#9FD8C8`
3. Mushroom Cellar: floor `#4A3B35`, wall `#2E2424`, accent `#6FD3FF`
4. Compost Depths: floor `#3A2E3F`, wall `#1F1A24`, accent `#B57BFF`

### Boss fights

Every attack is announced: a glowing windup, a shake before charges, or a blinking target mark on the floor. Below half health the boss is enraged. The boss on the 4th floor is the final boss, whichever one it is.

### Game feel

White 1-frame hit flash on all enemies, slight screen shake on big hits, particle bursts (leaves, husks) on death, squash-and-stretch on Mochi's movement, soft dark vignette at room edges.

## Open decisions

- Theme: haunted garden (recommended, assumed default) vs Malaysian folklore (kampung / rumah kayu, cute toyol and pocong). Confirm before producing lots of theme-specific content.
- Controls beyond keyboard.
- Final v1.0 scope.
