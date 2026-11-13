# Perseus Ascendant

A 16-bit style mythic action-platformer in seven trials. Plain JavaScript and HTML canvas, no build step.

## Run it

You need Node.js (any recent version).

```bash
node serve.js
```

Then open http://localhost:8080 in your browser.

Shortcut for testing: `http://localhost:8080/?world=4` jumps straight into World 4, and `?world=4&boss=1` into its boss fight.

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move | Arrows / A D | D-pad / stick |
| Jump (hold for height) | Z / Space / K | A |
| Drop through a marble slab | Down + Jump | |
| Strike (Up + strike = overhead) | X / J | X |
| Down-thrust pogo (Harpe) | hold Down in mid-air | |
| Shield of Athena | hold C / L / Shift | RB |
| Drink nectar (Kibisis) | Q / U | Select |
| Glide (Winged Sandals) | hold Jump while falling | |
| Vanish (Helm of Hades) | V / I | LB |
| Gorgon gaze (Head of Medusa) | B / O | Y |
| Pause / mute | Esc or P / M | Start |

On phones and tablets, on-screen buttons appear automatically.

## The seven worlds

| World | Boss | Relic won |
| --- | --- | --- |
| 1 Nemean Olive Groves | Nemean Lion: charges into walls and is stunned | Harpe: reach, overhead strike, pogo |
| 2 Marble Acropolis | Talos: only its head can be hurt | Shield of Athena: block and reflect |
| 3 Garden of the Hesperides | Ladon: reflect its fire back | Kibisis: carry up to 3 nectars |
| 4 Peaks of Cyllene | Celaeno: vulnerable after she dives | Winged Sandals: double jump and glide |
| 5 Stygian Threshold | Cerberus: three heads of fire | Helm of Hades: invisibility |
| 6 Isle of Sarpedon | Medusa: reflect or dodge her gaze | Head of Medusa: turn foes to stone |
| 7 Coast of Joppa | Cetus: petrify it, strike its head | Andromeda freed, ending |

## Where things live

- `js/levels.js`: the stage maps, drawn as text. Each stage is six 30-column screens; the legend at the top explains every character. This is the easiest place to redesign levels.
- `js/game.js`: physics, Perseus, enemies, pickups, rendering and the HUD. Movement tuning constants are at the top.
- `js/bosses.js`: the seven boss fights.
- `js/main.js`: title screen, story, world cards, pause, relic reveals, game over and the ending.
- `js/assets.js`: loads `assets/images` and shrinks the 512px animation strips to game size.
- `js/audio.js`: music from `assets/audio`, plus generated sound effects.
- `tools/check-levels.html`: with the server running, open http://localhost:8080/tools/check-levels.html to check that every stage can be finished. It plays each stage with scripted moves (enemies removed) and reports PASS, or the column where Perseus gets stuck. Add `?w=3` to check one world. Run it after editing any level.
- `tools/build-art.js`: builds the generated art in `assets/images/gen/` (ground tiles for each world, props, HUD icons, title logo, story panels, World 2 parallax layers, Cetus, Ladon, Celaeno, Andromeda, the serpent and the siren). To refresh it after generating new images:
  1. Save the images in `JPGs/` under the names in [ART_PROMPTS.md](ART_PROMPTS.md).
  2. `powershell -ExecutionPolicy Bypass -File tools/convert-jpgs.ps1` turns them into real PNGs in `PNGs/gen2/`.
  3. `node tools/build-art.js` (add `strips`, `tiles` or `pictures` to rebuild just one part). Frame and tile positions are listed at the top of the file; `node tools/art-key.js PNGs/gen2/<sheet>.png --lines` prints where the frames sit on a new sheet.
  Delete `assets/images/gen/` to fall back to the older art.
- `assets/images/small/`: copies of the big 512px animation strips shrunk to twice game size, so the game loads in about 2 seconds instead of 6+. The originals stay in `assets/images/`. If you replace one of those originals, delete its copy in `small/` (or the whole folder) and the game uses the original again.
- Add `&boxes` to a test URL (for example `?world=7&boss=1&boxes`) to outline where a boss can be hit.
- `tools/build-perseus.js`: builds Perseus's animations (`assets/images/perseus2/`) from the generated sprite sheets in `PNGs/`. It cuts each sheet on an 8×5 grid, cleans up guide lines and magenta edges, evens out scale, and lines up the feet. To swap in new art, edit the `SHEETS` and `ANIMS` lists at the top and run `node tools/build-perseus.js`.

Progress saves to the browser after each relic, and the title screen offers Continue.

Some music, sound effects, World 4's backgrounds and the visual effects come from free CC0 packs; see [CREDITS.md](CREDITS.md).

The source art (generated sheets in `JPGs/` and `PNGs/`) is not in the repository; the processed copies in `assets/` are all the game needs.
