# manufacturing-simulation

Browser simulation of a 6'2" operator assembling and packing NEMA17 motor controller units on the unit 322 floor, with per-step cycle timing and a playable game mode.

It is a single static page (`index.html`, three.js r128 from cdnjs) with no build step.

## Run locally

```sh
npx serve .
```

Or open `index.html` directly in a browser.

## Deploy

Import the repository in Vercel with the **Other** framework preset, no build command and the repository root as the output directory. `vercel.json` only turns on clean URLs.

## What it simulates

- **Floor:** unit 322 at 2325, 18'3½" × 47'5¼" (46'0¼" on the window side), with the washroom on the east wall, the entry door in the NE corner and the window wall on the west.
- **Operator:** 6'2" (1.88 m). Walks with A* path finding around walls and tables and reaches with two-bone arm IK, bending at the hips for 29" tables.
- **Stations:** three 6' folding tables.
  - Assembly bench: screwdriver, NEMA17 motors, motor controller PCBs, a jig and a screw dish.
  - Printer bench: a P2S with the backface spacer prints on the plate.
  - Pack-out bench: mailer box blanks, foam inserts and a finished-goods area.
- **Job:** 12 timed steps. Pull the spacer print, remove the 4 backface screws, fit the spacer and PCB, drive the screws, fold the box, add foam, nest the assembly, close the lid and move the box to finished goods.
- **Timing:** each step and walking time are clocked. Speeds run from 0.5× to 8×. A cycle is about 75 s, but gesture durations are placeholders, not measured.

The spacer geometry follows `backface-spacer-4mm.scad` from motorcontrol.tscircuit.com: 42 mm face, 31 mm pitch, 1 mm base, 3 mm sleeves, 22.6 mm rotor hole and a 5 mm corner clip. The PCB, P2S, box and foam are simplified stand-ins.

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

Touch devices get an on-screen stick and an Act button in game mode.

## Editing the layout

Table positions, the operator's start point and the patrol route are in the `LAYOUT` block near the top of the script in `index.html`. Each job step is an entry in `OPS`, written as a generator so its gestures run frame by frame and are timed automatically.

## Tests

```sh
npm install
npx playwright install chromium
npm test
```

`tests/smoke.mjs` loads the page in headless Chromium, runs the full job at a fixed time step and fails on any page error or if the job does not finish.
