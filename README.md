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

## What it simulates (batch line)

- **Floor:** unit 322 at 2325, 18'3½" × 47'5¼" (46'0¼" on the window side), with the washroom on the east wall, the entry door in the NE corner and the window wall on the west.
- **Operator:** 6'2" (1.88 m). Walks with A* around walls and tables, reaches with two-bone arm IK, and works upright at 42" standing desks (only a slight lean). Shaped limbs, a smooth head with hair, and both hands on the handles when carrying a rack, tote, tub or carton.
- **Batch:** 30 units travel the line together, one rack or tote per bench, and ship in one Amazon carton.
- **Line:** four 6' standing desks (42" high) along the window wall. The printer and label benches are standing desks too.
  1. **Assembly bench:** a foam stand of 30 NEMA17 motors, the spacer basket, three stacks of RP2040 motor controller boards, a SKIL Twist 2.0 4V screwdriver ([Ace 2033885](https://www.acehardware.com/p/2033885)) held by its grip with the bit on the screw while the other hand braces the side of the motor, clear of the screws, a jig, an empty 30-slot rack, and three Akro-Mils 30210 AkroBins: long M3 screws (blue tag), used stock screws (red tag) and pre-crimped JST-PH 2.0 motor cables, 6-pin at the motor and PHR-4 at the board (yellow tag). Everything is within reach of one standing spot. Each unit: load the motor, swap the 4 stock screws (too short once the 4 mm spacer and PCB are added) for long ones through a spacer and the PCB, plug in a cable, and rack it. The rack goes to QC when all 30 are done, or earlier with R.
  2. **QC bench:** each unit goes into a cradle with two USB-C cables (laptop data and the 10-port GaN charging station for power), spins, and moves to a second rack, which is carried to pack-out.
  3. **Pack-out bench:** each unit goes into a 7×4×3" white mailer with pink anti-static foam, with 2 coiled USB-C cables, a 45 W charger and a 2×4" label peeled from a stack of AveneMark sheets, then into a 30-box tote that is carried to ship-ready.
  4. **Ship-ready bench:** all 30 boxes go into the Amazon carton. Its end flaps fold in, then the long flaps fold over them. A strip of 48 mm tape runs along the seam and down both end faces, and the carton is set out by the door.
- **East wall:**
  - **3D printers:** a Bambu Lab P2S (25 spacers per plate) and an H2S (49 per plate). Finished plates are emptied into a tub, carried to the assembly bench, and poured into the spacer basket; then the next print starts.
  - **Label printer:** an Epson EcoTank ET-2400 that prints an AveneMark sheet (10 labels) every 45 s, up to 6 in its tray. Collecting them carries the sheets to the top of the pack-out stack.
- **Timing:** every step is clocked per unit and summed over the batch, with walking time separate. A batch of 30 takes about 46½ minutes of simulated time. Gesture durations are placeholders, not measured.

### Amazon carton for 30

The packed mailer is about 7.25 × 4.25 × 3.1 in. Thirty stack 2 × 3 × 5 into 14.5 × 12.75 × 15.6 in, so a **15 × 13 × 17 in (inside) carton** fits them with a little room for void fill. Each packed unit weighs roughly 0.56 kg (motor, PCB, spacer and cable ~0.31 kg; two USB-C cables ~0.10 kg; 45 W charger ~0.09 kg; mailer and foam ~0.06 kg), so the carton is about 37 lb. That is under the 50 lb FBA limit, and every side is under 25 in. Weigh and measure a packed unit to confirm before ordering cartons.

### Printer estimates

Spacers per plate is how many 42 × 42 mm spacers fit on the bed at a 46–48 mm pitch: 5 × 5 on the P2S (256 × 256 mm) and 7 × 7 on the H2S (340 × 320 mm). Plate times (2 h 10 m and 4 h) are estimates for ~2.6 g PLA parts, not slicer output.

The spacer follows `backface-spacer-4mm.scad` from motorcontrol.tscircuit.com. The label artwork is `label-preview.png` from [tscircuit/product-packaging](https://github.com/tscircuit/product-packaging). Parts follow the lab inventory where it lists them; the laptop, charging station and printers are simplified models.

### Controller board

The PCB is [imrishabh18/rp2040-motor-controller](https://tscircuit.com/imrishabh18/rp2040-motor-controller) v1.0.55, built from its `circuit.json` (`lib/models/rp2040-board-layout.ts`):

- 42.3 × 42.32 mm, 1.6 mm, with the chamfered outline and four 3.3 mm mounting holes on the 31 mm NEMA17 square.
- All 103 populated top-side parts at their placed positions (RP2040, DRV8825, CH224K, INA240s, buttons, crystal, passives), plus the 9 mm buzzer and the RGB status LED.
- **Cables:** both HRO TYPE-C-31-M-12 USB-C ports are on one edge. QC plugs the laptop's cable into **DATA** and the charging station's cable into **PWR**. The motor cable's PHR-4 slides into the side-entry S4B-PH-K-S (J1, pins A+ A− B+ B−) parallel to the board. The board is turned on the motor so J1 faces the motor's own 6-pin socket.

Parts are drawn as boxes sized from their footprints, merged into one mesh per material and shared by all 30 boards. Table positions are placeholders until the real layout is measured.

## Controls

| Input | Action |
| --- | --- |
| Drag | Orbit the camera |
| Scroll or pinch | Zoom, down to the screws |
| Right-drag or Shift-drag | Pan |
| 1 / 2 / 3 | Overview / Follow / Close-up camera |
| G | Toggle game mode |
| M | Sound on or off |
| WASD or arrows | Walk (game mode) |
| E | At a bench, run all of its remaining work without stopping. At the printers, collect finished plates into a tub; at the assembly bench with a tub, refill the spacer basket. While anything runs, E pauses it in place; walk away if you like, and E again walks back and carries on (game mode) |
| R | Carry what's ready to the next bench now, even a part-filled rack or tote; take an empty one back; or seal and ship (game mode) |
| F | Pick up or put back the screwdriver (game mode) |
| C | Go back to the paused work and carry on (game mode) |

Touch screens get an on-screen stick, an Act button (E) and a Carry button (R) in game mode.

### Jumping around the line

- **Simulate: Full batch (30) or 1 motor.** With 1 motor, unit 1 runs start to ship by itself, as rack, QC, box, carton and shipping (about 2 minutes of simulated time); the other 29 stay on the foam stand. Switching starts the line over, and the run, jump and timing counts follow the choice.
- **Jump to a bench with 30 ready** starts over with the whole batch already done up to that bench: 30 motors on the foam stand (assembly), 30 assembled in the rack at QC, 30 tested in the ready rack at pack-out, or 30 boxed in the tote at ship-ready. The operator stands at that bench; press E (game mode) or run the batch from there.
- **3D prints are ready** finishes both running prints now, so their plates can be collected.
- **Printers and labels during a run:** pause with E and walk to one of the blue floor circles in front of the label printer, the P2S or the H2S. When you walk away, the operator first sets down whatever was in hand (the screwdriver, a screw) on the bench, so nothing floats. On a circle, E does the job now: it takes the printed label sheets to the pack-out stack, or collects the finished plates and refills the assembly spacer basket. The assembly stays paused meanwhile. Press C, or E off the circles, to walk back, pick the work back up and carry on from exactly where you stopped. In simulation mode, the Collect buttons fit the job in after the current unit without stopping the batch.
- **Labels printed** fills the Epson's tray; **Collect labels to pack-out** (or E at the label bench) carries them over.
- The timing panel shows how many units are at each stage, how many labels are at pack-out, and the spacer and printer status.

### Sound

Synthesized in the browser with WebAudio, with no audio files. It starts after your first click or key press. Everything plays through a small-office reverb. The operator's sounds are panned and get quieter as the camera moves away.

- **Screwdriver:** the SKIL Twist is modelled as a ~15,000 rpm brushed motor, with motor whine, commutator buzz, planetary gear mesh and brush hiss. It clicks on, spins up, and coasts down with falling pitch. It labours (lower pitch) breaking a stock screw loose and as a long screw seats, then the clutch ratchets.
- **Stepper:** the spin test now accelerates, cruises and decelerates. The NEMA17's tone follows its real step rate (200 steps per revolution at the rotor's measured speed), so it sweeps up and down like a stepper on a DRV8825, with a knock when the coils energize.
- **Other sounds:**
  - footsteps, with a heel strike then the sole
  - a crisp USB-C detent and a duller JST latch
  - M3 screws pinging and bouncing in the bin
  - the board's 2.7 kHz buzzer chirp and the laptop's pass chime
  - cardboard creases and thumps
  - the tape gun's stick-slip screech and blade
  - PLA spacers clacking as they're poured
- **Printers:** the Epson's pick roller, carriage passes and eject, and the Bambu finish tone. They're quieter the further the camera is from those benches. There's no continuous background noise: the room is silent between sounds.

Use the Sound checkbox or M to mute.

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
