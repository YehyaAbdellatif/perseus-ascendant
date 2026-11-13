# Art prompts for Perseus Ascendant

One prompt per image, in priority order. Each prompt is self-contained: copy the code block, attach the listed reference images, and generate.

## Before you start

- **Reference images:** attach the files listed under "Attach" for each prompt. Many files in `assets/images` end in `.png` but are really WebP. If your generator rejects one, make a copy and rename it to `.webp`.
- **Save the results** as full-size PNGs (not screenshots or JPGs) into the folder named under "Save as", then tell me. I'll slice and wire them in.
- **Background colour:** sprites and props use flat magenta (#FF00FF) so they can be cut out cleanly. Avoid glows, motion blur and soft shadows on sprites, because they blend into the magenta.
- **If a row comes out wrong,** regenerate the whole sheet with "Keep everything identical except row N: …" added at the end, rather than mixing sheets from different generations.

---

## 1. Perseus with the Harpe: movement sheet (highest priority)

Fixes Perseus running and jumping with the short sword after World 1.

**Attach:** `PNGs/Gemini_Generated_Image_80xkjm80xkjm80xk-removebg-preview.png` (movement poses to match) and `PNGs/Gemini_Generated_Image_gd1ltpgd1ltpgd1l__2_-removebg-preview.png` (how she holds the Harpe)
**Save as:** `PNGs/perseus_harpe_movement.png`

```
A pixel art sprite sheet for a 2D side-scrolling action platformer in a 16-bit SNES-era style, matching the attached reference sheets exactly: same character, same proportions, same palette, same outline style, same scale. Flat solid magenta (#FF00FF) background. No text, labels, guide lines, borders, shadows, glows or motion blur.

The character is the same young androgynous Greek hero as in the references: shoulder-length straight black hair, fitted bronze chest plate over a short tunic with a skirt of hanging leather strips, bronze vambraces, brown leather sandals laced up the calves. She now carries the Harpe instead of the sword: a long wooden-hafted spear with a curved silver sickle-hook blade at the tip, held in one hand along her side, blade pointing forward and down, exactly as in the second reference. No shield.

Arrange the frames on a grid of 8 columns and 5 rows of equal cells, each character centred in its cell, all facing right in side view, feet on the same baseline in every grounded frame. Leave unused cells empty.

Row 1: idle stance holding the Harpe, 4 frames: subtle breathing and hair sway, never turning toward the viewer
Row 2: run cycle holding the Harpe, 7 frames
Row 3: jump holding the Harpe: crouch, takeoff, rising, peak, falling, landing, recover (7 frames)
Row 4: hurt: recoiling backward with head snapped back and arms flung out, Harpe still in hand, 2 frames; then forward somersault for a double jump, 4 frames
Row 5: defeat: stagger, drop to one knee, collapse forward, lying still, with the Harpe falling beside her (4 frames)
```

---

## 2. Ground tiles: one sheet per world (7 prompts)

Replaces the code-drawn ground so it matches your painted backgrounds. The layout is the same for every world, so the game can read them all the same way.

**Shared layout (already included in each prompt below):** 8 columns × 4 rows of square tiles.

### 2a. World 1: Nemean Olive Groves
**Attach:** `assets/images/bg_greek_hills.png`
**Save as:** `PNGs/tiles_w1_grove.png`

```
A pixel art tileset for a 2D side-scrolling platformer in a 16-bit SNES-era style, matching the palette and painterly-but-crisp pixel style of the attached background. Seen from the side. Flat solid magenta (#FF00FF) background between tiles. No text, labels, grid lines or shadows.

Theme: sunlit Greek olive-grove hills. Rich brown earth with small stones and roots, topped with a bright grassy edge with tufts and tiny wildflowers.

Draw exactly 32 square tiles of identical size on a grid of 8 columns and 4 rows, with a small even gap of magenta between tiles. Every tile must tile seamlessly with its neighbours.
Row 1: ground surface tiles: left end, middle (3 variations), right end, single-width pillar top, inner corner left, inner corner right
Row 2: ground fill tiles: left edge, middle (3 variations), right edge, bottom-left corner, bottom edge, bottom-right corner
Row 3: a thin one-way platform slab: left end, middle (2 variations), right end; then a crumbling version of the slab with cracks: left end, middle, right end, and a fully cracked breakable block
Row 4: upward-pointing bronze spikes on a ground base (2 variations); a hanging root/vine decoration; a small rock; a grass tuft; a flower clump; a broken column stub; a stone step
```

### 2b. World 2: Marble Acropolis
**Attach:** `assets/images/bg_acropolis_temple.png`, `assets/images/env_marble_platform.png`
**Save as:** `PNGs/tiles_w2_marble.png`

```
A pixel art tileset for a 2D side-scrolling platformer in a 16-bit SNES-era style, matching the palette and pixel style of the attached background and the attached marble platform. Seen from the side. Flat solid magenta (#FF00FF) background between tiles. No text, labels, grid lines or shadows.

Theme: white marble temple architecture. Large cut marble blocks with subtle grey veining and mortar lines, topped with a polished surface edged with a gold Greek-key (meander) trim, exactly like the attached marble platform.

Draw exactly 32 square tiles of identical size on a grid of 8 columns and 4 rows, with a small even gap of magenta between tiles. Every tile must tile seamlessly with its neighbours.
Row 1: ground surface tiles: left end, middle (3 variations), right end, single-width pillar top, inner corner left, inner corner right
Row 2: ground fill tiles: left edge, middle (3 variations), right edge, bottom-left corner, bottom edge, bottom-right corner
Row 3: a thin one-way marble slab with gold trim: left end, middle (2 variations), right end; then a cracked crumbling marble slab: left end, middle, right end, and a cracked breakable marble block
Row 4: upward-pointing bronze spikes on a marble base (2 variations); a fluted column segment; a column capital; a column base; a bronze brazier; a laurel garland; a stone step
```

### 2c. World 3: Garden of the Hesperides
**Attach:** `assets/images/bg_hesperides_garden.png`
**Save as:** `PNGs/tiles_w3_garden.png`

```
A pixel art tileset for a 2D side-scrolling platformer in a 16-bit SNES-era style, matching the palette and pixel style of the attached background. Seen from the side. Flat solid magenta (#FF00FF) background between tiles. No text, labels, grid lines or shadows.

Theme: an enchanted twilight garden. Pale mossy limestone with ivy, topped with lush deep-green grass, small pink and gold flowers and tiny glowing fireflies.

Draw exactly 32 square tiles of identical size on a grid of 8 columns and 4 rows, with a small even gap of magenta between tiles. Every tile must tile seamlessly with its neighbours.
Row 1: ground surface tiles: left end, middle (3 variations), right end, single-width pillar top, inner corner left, inner corner right
Row 2: ground fill tiles: left edge, middle (3 variations), right edge, bottom-left corner, bottom edge, bottom-right corner
Row 3: a thin one-way mossy stone slab: left end, middle (2 variations), right end; then a crumbling version: left end, middle, right end, and a cracked breakable block overgrown with roots
Row 4: thorny bramble hazard on a ground base (2 variations); hanging ivy; a golden apple on the ground; a flower clump; a small fountain stone; a broken arch fragment; a stone step
```

### 2d. World 4: Peaks of Cyllene
**Attach:** `assets/images/bg_olympus_peaks.png`
**Save as:** `PNGs/tiles_w4_peaks.png`

```
A pixel art tileset for a 2D side-scrolling platformer in a 16-bit SNES-era style, matching the palette and pixel style of the attached background. Seen from the side. Flat solid magenta (#FF00FF) background between tiles. No text, labels, grid lines or shadows.

Theme: a high snowy mountain. Cold grey granite with blue shadows and frost, topped with a thick white snow cap with small hanging icicles.

Draw exactly 32 square tiles of identical size on a grid of 8 columns and 4 rows, with a small even gap of magenta between tiles. Every tile must tile seamlessly with its neighbours.
Row 1: ground surface tiles: left end, middle (3 variations), right end, single-width pillar top, inner corner left, inner corner right
Row 2: ground fill tiles: left edge, middle (3 variations), right edge, bottom-left corner, bottom edge, bottom-right corner
Row 3: a thin one-way icy stone ledge: left end, middle (2 variations), right end; then a cracked crumbling crag: left end, middle, right end, and a cracked breakable boulder
Row 4: upward ice spikes on a rock base (2 variations); hanging icicles; a snow drift; a small rock; a frozen shrub; a weathered stone marker; a stone step
```

### 2e. World 5: Stygian Threshold
**Attach:** `assets/images/bg_river_styx.png`
**Save as:** `PNGs/tiles_w5_styx.png`

```
A pixel art tileset for a 2D side-scrolling platformer in a 16-bit SNES-era style, matching the palette and pixel style of the attached background. Seen from the side. Flat solid magenta (#FF00FF) background between tiles. No text, labels, grid lines or shadows.

Theme: the underworld shore of the River Styx. Dark purple-black basalt with faint glowing violet and teal cracks, topped with rough ash-grey stone and small purple crystals.

Draw exactly 32 square tiles of identical size on a grid of 8 columns and 4 rows, with a small even gap of magenta between tiles. Every tile must tile seamlessly with its neighbours.
Row 1: ground surface tiles: left end, middle (3 variations), right end, single-width pillar top, inner corner left, inner corner right
Row 2: ground fill tiles: left edge, middle (3 variations), right edge, bottom-left corner, bottom edge, bottom-right corner
Row 3: a thin one-way bone-white stone slab: left end, middle (2 variations), right end; then a crumbling version: left end, middle, right end, and a cracked breakable basalt block
Row 4: upward obsidian spikes on a basalt base (2 variations); a hanging stalactite; a crystal cluster; a skull half-buried in ash; a small rock; a spectral wall segment (translucent violet energy, opaque in the image); a stone step
```

### 2f. World 6: Isle of Sarpedon (Gorgon's cavern)
**Attach:** `assets/images/bg_stygian_cavern.png`
**Save as:** `PNGs/tiles_w6_gorgon.png`

```
A pixel art tileset for a 2D side-scrolling platformer in a 16-bit SNES-era style, matching the palette and pixel style of the attached background. Seen from the side. Flat solid magenta (#FF00FF) background between tiles. No text, labels, grid lines or shadows.

Theme: a damp cavern where Medusa lives. Cold grey-green stone with glowing green lichen, cracked flagstones and snake-scale carvings.

Draw exactly 32 square tiles of identical size on a grid of 8 columns and 4 rows, with a small even gap of magenta between tiles. Every tile must tile seamlessly with its neighbours.
Row 1: ground surface tiles: left end, middle (3 variations), right end, single-width pillar top, inner corner left, inner corner right
Row 2: ground fill tiles: left edge, middle (3 variations), right edge, bottom-left corner, bottom edge, bottom-right corner
Row 3: a thin one-way carved stone slab: left end, middle (2 variations), right end; then a crumbling version: left end, middle, right end, and a cracked breakable block
Row 4: upward stone spikes on a base (2 variations); hanging moss; a lichen clump; a stone snake carving; a petrified hand reaching from the ground; a sentinel eye carved into stone; a stone step
```

### 2g. World 7: Coast of Joppa
**Attach:** `assets/images/bg_joppa_coast.png`
**Save as:** `PNGs/tiles_w7_coast.png`

```
A pixel art tileset for a 2D side-scrolling platformer in a 16-bit SNES-era style, matching the palette and pixel style of the attached stormy background. Seen from the side. Flat solid magenta (#FF00FF) background between tiles. No text, labels, grid lines or shadows.

Theme: storm-lashed sea cliffs. Wet dark slate rock with blue-grey highlights, barnacles and seaweed, topped with slick rock and splashes of sea foam.

Draw exactly 32 square tiles of identical size on a grid of 8 columns and 4 rows, with a small even gap of magenta between tiles. Every tile must tile seamlessly with its neighbours.
Row 1: ground surface tiles: left end, middle (3 variations), right end, single-width pillar top, inner corner left, inner corner right
Row 2: ground fill tiles: left edge, middle (3 variations), right edge, bottom-left corner, bottom edge, bottom-right corner
Row 3: a thin one-way driftwood plank: left end, middle (2 variations), right end; then a crumbling rock ledge: left end, middle, right end, and a cracked breakable boulder
Row 4: upward coral-and-urchin spikes on a rock base (2 variations); hanging seaweed; a barnacle cluster; a tide pool; a mooring post; a small rock; a stone step
```

---

## 3. Backgrounds split into layers (one prompt per world)

Gives the scenery depth by scrolling each layer at a different speed. Ask for **three separate images per world**. The three prompts below are for World 2; for the other worlds, attach that world's background and swap the theme sentence (suggested themes are listed after the prompts).

**Attach:** that world's current background, e.g. `assets/images/bg_acropolis_temple.png`
**Save as:** `PNGs/bg_w2_sky.png`, `PNGs/bg_w2_far.png`, `PNGs/bg_w2_mid.png`

**Sky layer:**
```
A wide pixel art background layer for a 2D side-scrolling platformer, 16-bit SNES-era style, matching the colours and pixel style of the attached image. Only the sky: sun, clouds and soft gradient, with no ground, buildings, trees or mountains. The image must tile seamlessly left-to-right (the left and right edges match). Wide panoramic format, 3:1.
Theme: a bright clear Greek sky over a marble acropolis.
```

**Far layer:**
```
A wide pixel art background layer for a 2D side-scrolling platformer, 16-bit SNES-era style, matching the colours and pixel style of the attached image. Only the distant scenery (far hills, mountain silhouettes, distant temples), occupying the lower half of the image, softened slightly by atmospheric haze. Everything above the scenery is flat solid magenta (#FF00FF). The image must tile seamlessly left-to-right. Wide panoramic format, 3:1.
Theme: distant hills crowned with white temples.
```

**Mid layer:**
```
A wide pixel art background layer for a 2D side-scrolling platformer, 16-bit SNES-era style, matching the colours and pixel style of the attached image. Only the nearer scenery (columns, cypress trees, stairs, statues), occupying the lower 60% of the image, with no ground strip along the very bottom. Everything above and between the scenery is flat solid magenta (#FF00FF). The image must tile seamlessly left-to-right. Wide panoramic format, 3:1.
Theme: marble colonnades, cypress trees and bronze braziers.
```

Themes for the other worlds (attach that world's background):
- **World 1** (`bg_greek_hills.png`): golden-hour sky / rolling olive hills with a far acropolis / olive trees, cypresses, stone walls.
- **World 3** (`bg_hesperides_garden.png`): violet twilight sky with stars / far ruined arches / the golden-apple tree, fountains, ivy-covered arches.
- **World 4** (`bg_olympus_peaks.png`): bright high-altitude sky / far snowy peaks above a sea of clouds / near icy crags.
- **World 5** (`bg_river_styx.png`): dark cavern ceiling with violet cracks / far stalagmites and distant lights / near jagged rocks and purple mist.
- **World 6** (`bg_stygian_cavern.png`): cave ceiling with green lichen glow / far cavern pillars / near petrified statues of warriors.
- **World 7** (`bg_joppa_coast.png`): storm clouds with lightning / far sea and distant city / near sea cliffs and crashing spray.

---

## 4. Cetus animation

**Attach:** `assets/images/cetus_leviathan.png`
**Save as:** `PNGs/cetus_frames.png`

```
A pixel art sprite sheet of the attached sea monster, Cetus, for a 2D side-scrolling platformer boss fight in a 16-bit SNES-era style. Match the reference exactly: same design, colours, glowing eye, fins and scale. The monster faces right, shown from the chest up as if rising out of the sea (the bottom edge of the body is cut off cleanly). Flat solid magenta (#FF00FF) background. No text, water, splashes, glows or motion blur.

Arrange the frames on a grid of 4 columns and 3 rows of equal cells, the monster in the same position in every cell.
Row 1: idle: slow menacing sway with the jaw opening and closing slightly, 4 frames
Row 2: bite attack: rearing back, lunging forward with jaws wide open, jaws snapping shut, recovering (4 frames)
Row 3: stunned by the Gorgon's gaze: head drooping, eye dimmed, body starting to turn grey stone from the head down (2 frames); roaring with head raised (2 frames)
```

---

## 5. Andromeda: rescue and ending poses

**Attach:** `assets/images/princess_andromeda_walk.png`
**Save as:** `PNGs/andromeda_rescue.png`

```
A pixel art sprite sheet for a 2D side-scrolling platformer in a 16-bit SNES-era style, matching the attached reference exactly: the same Ethiopian princess with radiant dark skin, long curly black hair, flowing white silk gown and gold jewellery, same proportions, palette and scale. Flat solid magenta (#FF00FF) background. No text, labels, guide lines, shadows, glows or motion blur.

Arrange the frames on a grid of 8 columns and 4 rows of equal cells, centred, in side view, feet on the same baseline.
Row 1: chained to a sea cliff: arms raised above her head, wrists bound in iron shackles with short broken chain ends, struggling, 4 frames, facing right
Row 2: breaking free: shackles shattering, arms coming down, stepping forward in relief, 4 frames, facing right
Row 3: running, 6 frames, facing right
Row 4: standing proudly wearing a slim gold crown, 4 frames of gentle breathing, facing right
```

---

## 6. Props sheet

**Attach:** `assets/images/bg_acropolis_temple.png` (style and palette), `assets/images/env_marble_platform.png`
**Save as:** `PNGs/props.png`

```
A pixel art sprite sheet of small game props for a 2D side-scrolling platformer set in ancient Greece, 16-bit SNES-era style, matching the palette and pixel style of the attached images. Side view. Flat solid magenta (#FF00FF) background. No text, labels, shadows, glows or motion blur.

Arrange the items on a grid of 8 columns and 5 rows of equal cells, each item centred and resting on the bottom of its cell.
Row 1: terracotta amphora with black-figure decoration, then 3 frames of it shattering into shards; the same amphora painted rose-pink (nectar), then 3 shattering frames
Row 2: green-glazed amphora (magic draught), then 3 shattering frames; a wooden treasure chest bound in bronze, closed; the same chest open with gold glowing inside; a gold drachma coin face-on; a blue gemstone
Row 3: a gold drachma coin spinning, 6 frames; a small lore urn with a scroll poking out; a stone hint stele with carved glyphs
Row 4: a bronze altar brazier, unlit; the same brazier lit with golden-blue flames, 4 frames of flickering fire; a hanging bronze lamp; a laurel wreath
Row 5: a temple doorway gate with marble columns and a triangular pediment, closed; the same gate open with warm light inside; a broken statue; a pile of marble rubble
```

---

## 7. New enemies

### 7a. Venomous serpent (Garden of the Hesperides)
**Attach:** `assets/images/skeleton_warrior_walk.png` (match scale and style)
**Save as:** `PNGs/enemy_serpent.png`

```
A pixel art sprite sheet for an enemy in a 2D side-scrolling platformer, 16-bit SNES-era style, matching the scale, outline and shading style of the attached reference. Flat solid magenta (#FF00FF) background. No text, labels, shadows, glows or motion blur.

The enemy is a venomous garden serpent: a thick emerald-green snake with gold belly scales, a hooded cobra-like head and dripping venom fangs. Side view, facing right, coiled low to the ground.

Arrange the frames on a grid of 8 columns and 4 rows of equal cells, resting on the same baseline.
Row 1: slithering forward, 6 frames
Row 2: rearing up and spitting a glob of venom, 4 frames (draw the venom glob separately in the last cell of the row)
Row 3: lunging bite, 4 frames
Row 4: hit and defeated: recoiling, then collapsing and fading, 4 frames
```

### 7b. Siren (Coast of Joppa)
**Attach:** `assets/images/olympian_harpy_bird_fly.png` (match scale and style)
**Save as:** `PNGs/enemy_siren.png`

```
A pixel art sprite sheet for a flying enemy in a 2D side-scrolling platformer, 16-bit SNES-era style, matching the scale, outline and shading style of the attached harpy reference. Flat solid magenta (#FF00FF) background. No text, labels, shadows, glows or motion blur.

The enemy is a sea siren: a woman's upper body with sea-green skin and long wet teal hair, the lower body and wings of a sea bird with grey-blue feathers, and a small golden lyre in one hand. Side view, facing right.

Arrange the frames on a grid of 8 columns and 4 rows of equal cells.
Row 1: hovering with wings beating, 6 frames
Row 2: singing: head tilted back, mouth open, playing the lyre (4 frames; she releases a sound wave in the game, which I'll draw)
Row 3: diving attack, 4 frames
Row 4: hit and defeated: recoiling, then falling with feathers scattering, 4 frames
```

### 7c. Celaeno, Queen of Harpies (World 4 boss)
**Attach:** `assets/images/olympian_harpy_bird_fly.png`
**Save as:** `PNGs/boss_celaeno.png`

```
A pixel art sprite sheet for a flying boss in a 2D side-scrolling platformer, 16-bit SNES-era style, matching the outline and shading style of the attached harpy reference but drawn larger and grander. Flat solid magenta (#FF00FF) background. No text, labels, shadows, glows or motion blur.

The boss is Celaeno, Queen of the Harpies: a tall fierce harpy with crimson and gold plumage, a bronze crown, long talons and a storm-grey cape of feathers. Side view, facing right.

Arrange the frames on a grid of 8 columns and 5 rows of equal cells.
Row 1: hovering with wings beating, 6 frames
Row 2: throwing a fan of sharp feathers with a sweep of one wing, 4 frames
Row 3: screeching wind-up, then diving downward with talons forward, 4 frames
Row 4: landed on the ground, exhausted and vulnerable, wings drooping, 4 frames
Row 5: defeated: knocked out of the air, feathers bursting, falling, 4 frames
```

---

## 8. Ladon animation

**Attach:** `assets/images/boss_ladon.png`
**Save as:** `PNGs/boss_ladon_frames.png`

```
A pixel art sprite sheet of the attached multi-headed dragon, Ladon, for a 2D side-scrolling platformer boss fight in a 16-bit SNES-era style. Match the reference exactly: same four heads, green scales, gold belly, horns and coils, same scale. Side view, facing right, coiled body resting on the ground. Flat solid magenta (#FF00FF) background. No text, labels, shadows, fire, glows or motion blur.

Arrange the frames on a grid of 4 columns and 4 rows of equal cells, the coils in the same position in every cell.
Row 1: idle: heads weaving and hissing, 4 frames
Row 2: striking: heads pulling back, then all lunging forward and low with jaws open, then recovering (4 frames)
Row 3: breathing fire: heads rearing up, then mouths opening wide toward the right (4 frames; I'll add the fire in the game)
Row 4: stunned: heads dazed and drooping, 2 frames; defeated: heads collapsing onto the coils, 2 frames
```

---

## 9. Title logo

**Attach:** `assets/images/relic_shield_athena.png` (metal style), `assets/images/weapon_harpe.png`
**Save as:** `PNGs/title_logo.png`

```
A pixel art title logo for a 16-bit SNES-era video game called "PERSEUS ASCENDANT". The words are carved in bold gold-and-bronze Greek-style capital letters with a dark outline, PERSEUS large on the first line and ASCENDANT smaller on the second line. Behind the text: the round mirror Shield of Athena with a silver hooked Harpe crossed diagonally behind it, and a laurel wreath framing the bottom. Flat solid magenta (#FF00FF) background. Crisp pixel edges, no gradients, glows, shadows or blur. Wide format, 2:1. The spelling must be exactly PERSEUS ASCENDANT.
```

---

## 10. Story panels (intro and ending)

Six illustrations, one per prompt. **Attach for all:** `PNGs/Gemini_Generated_Image_80xkjm80xkjm80xk-removebg-preview.png` (Perseus), plus the extra file listed.
**Save as:** `PNGs/story_1.png` … `PNGs/story_6.png`

Start each prompt with this line:
```
A 16-bit SNES-era pixel art cutscene illustration, 16:9, rich painterly pixel art like the attached references, no text or speech bubbles. The hero is the young androgynous Greek hero from the attached sheet: shoulder-length black hair, bronze chest plate, leather-strip skirt, laced sandals.
```
Then add one of:
1. "On the shore of the island of Seriphos at dawn, the hero holds a plain bronze short sword and looks out to sea toward distant mountains."
2. "In a marble temple, the goddess Athena, tall and glowing, offers the hero a round mirror-polished shield." (also attach `assets/images/relic_shield_athena.png`)
3. "Deep in a cave full of stone statues, the hero creeps forward holding up the mirror shield, in which the reflection of Medusa's snake hair is visible." (also attach `assets/images/medusa_boss_idle.png`)
4. "On a storm-swept sea cliff, the princess Andromeda is chained to the rock while the huge sea monster Cetus rises from the waves below." (also attach `assets/images/princess_andromeda_walk.png` and `assets/images/cetus_leviathan.png`)
5. "The hero raises the severed head of Medusa toward Cetus, its eyes blazing green, as the monster turns to stone." (also attach `assets/images/relic_medusa_head.png` and `assets/images/cetus_leviathan.png`)
6. "In a sunlit throne room in Mycenae, the hero and Andromeda stand side by side wearing gold crowns, as the six divine relics float upward in a beam of light." (also attach `assets/images/princess_andromeda_walk.png`)

---

## 11. HUD icons

**Attach:** `assets/images/relic_shield_athena.png`, `assets/images/relic_medusa_head.png`
**Save as:** `PNGs/hud_icons.png`

```
A pixel art sheet of small user-interface icons for a 16-bit SNES-era Greek mythology platformer, matching the colour and outline style of the attached relic images. Flat solid magenta (#FF00FF) background. No text, labels, shadows, glows or blur.

Arrange the icons on a grid of 8 columns and 2 rows of equal cells, each icon centred and simple enough to read at very small size.
Row 1: a full red heart; a half heart; an empty heart outline; a gold drachma coin; a pink nectar flask; a green draught flask; a small Perseus head portrait; a gold laurel wreath
Row 2: an empty ornate bronze relic slot frame; a Greek-key (meander) border segment that tiles horizontally; a corner piece of the same border; a green Gorgon-eye icon; a violet Helm-of-Hades power icon; a winged sandal icon; a Harpe icon; a shield icon
```
