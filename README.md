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
simulation.startScenario("run_batch")
simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 6000 })
simulation.ctx.progress.rowSeconds // seconds per step, summed over the batch
simulation.ctx.progress.cycleSeconds // total including walking
```

## What it simulates (v2 batch line)

- **Floor:** unit 322 at 2325, 18'3½" × 47'5¼" (46'0¼" on the window side), with the washroom on the east wall, the entry door in the NE corner and the window wall on the west.
- **Operator:** 6'2" (1.88 m). Walks with A* around walls and tables, reaches with two-bone arm IK and bends at the hips for 29" tables.
- **Batch:** 30 units travel the line together, one rack or tote per bench, and ship in one Amazon carton.
- **Line:** four 6' folding tables along the window wall.
  1. **Assembly bench:** a foam stand of 30 NEMA17 motors, the spacer basket, three stacks of controller PCBs, a screwdriver, a jig, an empty 30-slot rack, and three Akro-Mils 30210 AkroBins: long M3 screws (blue tag), used stock screws (red tag) and pre-crimped JST-PH 2.0 6-pin motor cables (yellow tag). Everything is within reach of one standing spot. Each unit: load the motor, swap the 4 stock screws (too short once the 4 mm spacer and PCB are added) for long ones through a spacer and the PCB, plug in a cable, and rack it. The full rack is then carried to QC.
  2. **QC bench:** each unit goes into a cradle with two USB-C cables (laptop data and the 10-port GaN charging station for power), spins, and moves to a second rack, which is carried to pack-out.
  3. **Pack-out bench:** each unit goes into a 7×4×3" white mailer with pink anti-static foam, with 2 coiled USB-C cables, a 45 W charger and a 2×4" label peeled from a stack of AveneMark sheets, then into a 30-box tote that is carried to ship-ready.
  4. **Ship-ready bench:** all 30 boxes go into the Amazon carton, which is folded, taped and set out by the door.
- **East wall:**
  - **3D printers:** a Bambu Lab P2S (25 spacers per plate) and an H2S (49 per plate). Finished plates are emptied into a tub, carried to the assembly bench, and poured into the spacer basket; then the next print starts.
  - **Label printer:** an Epson EcoTank ET-2400 that keeps printing AveneMark label sheets.
- **Timing:** every step is clocked per unit and summed over the batch, with walking time separate. A batch of 30 takes about 46½ minutes of simulated time. Gesture durations are placeholders, not measured.

### Amazon carton for 30

The packed mailer is about 7.25 × 4.25 × 3.1 in. Thirty stack 2 × 3 × 5 into 14.5 × 12.75 × 15.6 in, so a **15 × 13 × 17 in (inside) carton** fits them with a little room for void fill. Each packed unit weighs roughly 0.56 kg (motor, PCB, spacer and cable ~0.31 kg; two USB-C cables ~0.10 kg; 45 W charger ~0.09 kg; mailer and foam ~0.06 kg), so the carton is about 37 lb. That is under the 50 lb FBA limit, and every side is under 25 in. Weigh and measure a packed unit to confirm before ordering cartons.

### Printer estimates

Spacers per plate is how many 42 × 42 mm spacers fit on the bed at a 46–48 mm pitch: 5 × 5 on the P2S (256 × 256 mm) and 7 × 7 on the H2S (340 × 320 mm). Plate times (2 h 10 m and 4 h) are estimates for ~2.6 g PLA parts, not slicer output.

The spacer follows `backface-spacer-4mm.scad` from motorcontrol.tscircuit.com. The label artwork is `label-preview.png` from [tscircuit/product-packaging](https://github.com/tscircuit/product-packaging). Parts follow the lab inventory where it lists them; the PCB, laptop, charging station and printers are simplified models. Table positions are placeholders until the real layout is measured.

## Controls

| Input | Action |
| --- | --- |
| Drag | Orbit the camera |
| Scroll or pinch | Zoom, down to the screws |
| Right-drag or Shift-drag | Pan |
| 1 / 2 / 3 | Overview / Follow / Close-up camera |
| G | Toggle game mode |
| WASD or arrows | Walk (game mode) |
| E | At a bench, run all of its remaining work without stopping. At the printers, collect finished plates into a tub; at the assembly bench with a tub, refill the spacer basket. While anything runs, E pauses it in place; walk away if you like, and E again walks back and carries on (game mode) |
| F | Pick up or put back the screwdriver (game mode) |

Touch screens get an on-screen stick and an Act button (E) in game mode.

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
| `lib/job` | The batch plan (`job-plan.ts`): stages per bench, per-unit steps, carries, and printer refills. |
| `lib/simulation` | `ManufacturingSimulation`, scenarios and game-mode actions. No DOM dependencies. |
| `lib/viewer` | React viewer: renderer, camera, HUD and input. |

Each job step is a `JobStep` whose `run` is a generator, so its gestures advance one simulation step at a time and are timed automatically. Add a step by writing a generator from the motions in `lib/tasks/operator-motions.ts` and adding it to a stage in `lib/job/job-plan.ts`. `BATCH_SIZE` in `lib/layout/station-layout.ts` sets the batch.

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
