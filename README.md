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
simulation.ctx.progress.stepSeconds // seconds spent in each of the 12 steps
simulation.ctx.progress.cycleSeconds // total including walking
```

## What it simulates

- **Floor:** unit 322 at 2325, 18'3½" × 47'5¼" (46'0¼" on the window side), with the washroom on the east wall, the entry door in the NE corner and the window wall on the west.
- **Operator:** 6'2" (1.88 m). Walks with A* around walls and tables, reaches with two-bone arm IK and bends at the hips for 29" tables.
- **Stations:** three 6' folding tables.
  - Assembly bench: screwdriver, NEMA17 motors, motor controller PCBs, a jig and a screw dish.
  - Printer bench: a P2S with backface spacer prints on the plate.
  - Pack-out bench: mailer box blanks, foam inserts and a finished-goods area.
- **Job:** 12 timed steps. Pull the spacer print, remove the 4 backface screws, fit the spacer and PCB, drive the screws, fold the box, add foam, nest the assembly, close the lid and move the box to finished goods.
- **Timing:** each step and walking time are clocked, at 0.5× to 8×. A cycle is about 75 s. Gesture durations are placeholders, not measured.

The spacer follows `backface-spacer-4mm.scad` from motorcontrol.tscircuit.com: 42 mm face, 31 mm pitch, 1 mm base, 3 mm sleeves, 22.6 mm rotor hole and a 5 mm corner clip. The PCB, P2S, box and foam are simplified stand-ins.

## Controls

| Input | Action |
| --- | --- |
| Drag | Orbit the camera |
| Scroll or pinch | Zoom, down to the screws |
| Right-drag or Shift-drag | Pan |
| 1 / 2 / 3 | Overview / Follow / Close-up camera |
| G | Toggle game mode |
| WASD or arrows | Walk (game mode) |
| E | Do the next job step at this station (game mode) |
| F | Pick up or put back the screwdriver (game mode) |

Touch screens get an on-screen stick and an Act button in game mode.

## Code layout

| Path | Contents |
| --- | --- |
| `lib/layout` | Floor plan, table placements and stations. Table positions are placeholders; change them in `station-layout.ts`. |
| `lib/models` | Three.js models: table, NEMA17, spacer, PCB, screwdriver, P2S, mailer box, foam, room. |
| `lib/world` | Builds the benches and remembers where each part sits. |
| `lib/navigation` | Walkable-floor test, nav grid and A* path finding. |
| `lib/operator` | 6'2" operator rig, two-bone IK and per-frame pose. |
| `lib/tasks` | Generator-based coroutines and operator motions (walk, reach, grab, move, place). |
| `lib/job` | The 12 job steps, grouped by station. |
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
