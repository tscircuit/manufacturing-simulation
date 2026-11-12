# manufacturing-simulation

Browser simulation of a 6'2" operator assembling and packing NEMA17 motor controller units on the unit 322 floor, with per-step cycle timing and a playable game mode.

## Usage

```sh
bun install
bun run start
```

`bun run start` opens React Cosmos; pick **pages / manufacturing-simulation**.

The simulation also runs headless, which is how the tests time the job:

```ts
import { ManufacturingSimulation } from "@tscircuit/manufacturing-simulation"

const simulation = new ManufacturingSimulation()
simulation.startScenario("assemble_and_pack")
simulation.runUntilIdle({ dtSeconds: 0.02, maxSeconds: 300 })
simulation.ctx.progress.stepSeconds // seconds spent in each of the 15 steps
simulation.ctx.progress.cycleSeconds // total including walking
```

## What it simulates (v2 line)

- **Floor:** unit 322 at 2325, 18'3½" × 47'5¼" (46'0¼" on the window side), with the washroom on the east wall, the entry door in the NE corner and the window wall on the west.
- **Operator:** 6'2" (1.88 m). Walks with A* around walls and tables, reaches with two-bone arm IK and bends at the hips for 29" tables.
- **Line:** four 6' folding tables end to end along the window wall:
  1. **Assembly bench:** a basket of printed NEMA17 backface spacers, three rows of NEMA17 motors, a jig, three stacks of controller PCBs, a screwdriver, and three black Akro-Mils 30210 AkroBins. The blue-tagged bin holds the long M3 screws; the red-tagged bin starts empty and collects the motor's stock screws, which are too short once the 4 mm spacer and PCB are added; the yellow-tagged bin holds pre-crimped JST-PH 2.0 6-pin motor cables.
  2. **QC bench:** a cradle, a laptop running the motor-bench page, and a 10-port USB-C GaN charging station. One USB-C goes to the PCB data port, one to its PD power port. The motor spins and the screen shows the result.
  3. **Pack-out bench:** a stack of The Boxery 7×4×3" white tuck mailers with pink anti-static foam pre-cut top and bottom, coiled LISEN USB-C cables, 45 W USB-C chargers, an Epson EcoTank ET-2400, and a printed AveneMark 2×4" label sheet (10-up).
  4. **Ship-ready bench.**
- **Job:** 15 timed steps. Take a spacer, load the motor, swap the 4 stock screws for long ones through the spacer and PCB, lift a cable out of its bin and plug both ends, run the USB-C spin test, pack the motor with 2 USB-C cables and a charger, close the box, apply the label, and move it to ship-ready.
- **Timing:** each step and walking time are clocked, at 0.5× to 8×. A cycle is about 1:32. Gesture durations are placeholders, not measured.

The spacer follows `backface-spacer-4mm.scad` from motorcontrol.tscircuit.com. The label artwork is `label-preview.png` from [tscircuit/product-packaging](https://github.com/tscircuit/product-packaging) (2" wide × 4" tall when applied). Parts are from the lab inventory where it lists them; the PCB, laptop and charging station are simplified models. Table positions are placeholders until the real layout is measured.

## Controls

| Input | Action |
| --- | --- |
| Drag | Orbit the camera |
| Scroll or pinch | Zoom, down to the screws |
| Right-drag or Shift-drag | Pan |
| 1 / 2 / 3 | Overview / Follow / Close-up camera |
| G | Toggle game mode |
| WASD or arrows | Walk (game mode) |
| E | Do the next job step at this station; while anything runs, pause or resume it in place (game mode) |
| C | Run every remaining step at this bench without stopping (game mode) |
| F | Pick up or put back the screwdriver (game mode) |

Touch screens get an on-screen stick, an Act button and a Run bench button in game mode.

When the operator stands between the camera and the work, or the camera is zoomed inside him, his body fades out so the work stays visible.

## Code layout

| Path | Contents |
| --- | --- |
| `lib/layout` | Floor plan, table placements and stations. Table positions are placeholders; change them in `station-layout.ts`. |
| `lib/models` | Three.js models: tables, NEMA17, spacer, PCB, screwdriver, bins, cables and plugs, laptop, chargers, white mailer with foam, label sheet, printer, room. |
| `lib/world` | Builds the benches and remembers where each part sits. |
| `lib/navigation` | Walkable-floor test, nav grid and A* path finding. |
| `lib/operator` | 6'2" operator rig, two-bone IK and per-frame pose. |
| `lib/tasks` | Generator-based coroutines and operator motions (walk, reach, grab, move, place, plug in, unplug). |
| `lib/job` | The 15 job steps, grouped by station. |
| `lib/simulation` | `ManufacturingSimulation`, scenarios and game-mode actions. No DOM dependencies. |
| `lib/viewer` | React viewer: renderer, camera, HUD and input. |

Each job step is a `JobStep` whose `run` is a generator, so its gestures advance one simulation step at a time and are timed automatically. Add a step by writing a generator from the motions in `lib/tasks/operator-motions.ts` and listing it in `lib/job/assembly-job-steps.ts`.

## Development

```sh
bun test
bun run typecheck
bun run format
```

## Deploy

Vercel builds the Cosmos export with `bun run build:site` and serves `cosmos-export/` (see `vercel.json`). The simulation alone, without the Cosmos sidebar, is at:

```
/renderer.html?fixtureId=%7B%22path%22%3A%22pages%2Fmanufacturing-simulation.page.tsx%22%7D&locked=true
```
