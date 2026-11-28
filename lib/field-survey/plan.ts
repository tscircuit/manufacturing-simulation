import { CurvePath, LineCurve3, QuadraticBezierCurve3, Vector3 } from "three"

export const phases = [
  {
    id: "load",
    start: 0,
    title: "Check the cart",
    location: "2325 Third Street",
    detail:
      "Check the Uline H-2504BL at the loading entrance. It carries the motor kit, USB-PD bank, battery laptop, receiver and folded antenna.",
  },
  {
    id: "walk",
    start: 5,
    title: "Walk to the meadow",
    location: "20th Street",
    detail:
      "Push the cart west along 20th, across Tennessee and into Esprit Park at Minnesota. The walk is compressed for playback.",
  },
  {
    id: "set",
    start: 23,
    title: "Set the 3 m spacing",
    location: "Esprit Park · south meadow",
    detail:
      "Leave the cart on the path. Carry out the wooden motor table and the antenna tripod. Measure from the motor to the antenna center.",
  },
  {
    id: "ambient",
    start: 39,
    title: "Record the ambient",
    location: "Esprit Park · south meadow",
    detail:
      "Keep the receiver on and both motor USB feeds off. Sweep the background in horizontal and vertical polarization.",
  },
  {
    id: "hold",
    start: 45,
    title: "Hold the motor",
    location: "Esprit Park · south meadow",
    detail:
      "Power the controller from the USB-PD bank. Command holding current from the battery laptop and repeat the same sweep.",
  },
  {
    id: "step",
    start: 51,
    title: "Run the stepping sweep",
    location: "Esprit Park · south meadow",
    detail:
      "Step the motor with the same cable layout. Repeat both antenna polarizations and compare with the ambient and holding runs.",
  },
  {
    id: "pack",
    start: 59,
    title: "Stow the instruments",
    location: "Esprit Park · south meadow",
    detail:
      "Switch off the motor, fold the tripod and table, and carry both kits back to their places on the cart.",
  },
  {
    id: "return",
    start: 75,
    title: "Return to HQ",
    location: "20th Street → Third Street",
    detail:
      "Wheel the packed equipment back along 20th to the loading entrance at 2325 Third.",
  },
] as const

export const duration = 95
export const motorSite = new Vector3(-18.35, 0, -11.2)
export const antennaSite = new Vector3(motorSite.x - 3, 0, motorSite.z)
export const cartSite = new Vector3(-16, 0, -8)
const point = (x: number, z: number) => new Vector3(x, 0, z)
const corners = [
  point(17, 10),
  point(17, 0),
  point(-13.5, 0),
  point(-13.5, -8),
  cartSite,
]

// Streets are shortened for playback. Equipment and distances in the meadow are in metres.
export const route = new CurvePath<Vector3>()
let previous = corners[0]
for (let i = 1; i < corners.length - 1; i++) {
  const corner = corners[i]
  const before = corner
    .clone()
    .add(corners[i - 1].clone().sub(corner).setLength(0.8))
  const after = corner
    .clone()
    .add(corners[i + 1].clone().sub(corner).setLength(0.8))
  route.add(new LineCurve3(previous, before))
  route.add(new QuadraticBezierCurve3(before, corner, after))
  previous = after
}
route.add(new LineCurve3(previous, cartSite))

export const clamp = (n: number) => Math.max(0, Math.min(1, n))
export const ease = (n: number) => {
  const t = clamp(n)
  return t * t * (3 - 2 * t)
}
const interpolate = (a: Vector3, b: Vector3, t: number) =>
  a.clone().lerp(b, ease(t))

export function phaseAt(seconds: number) {
  return phases.findLast((phase) => seconds >= phase.start) ?? phases[0]
}

// Position of the operator standing beside each kit. A complete out-and-back is
// part of both transfers so the second kit waits on the cart until it is collected.
const pickup = new Vector3(-15.96, 0, -8.58)
const beside = (site: Vector3) => site.clone().add(new Vector3(0, 0, -0.55))
const besideTable = beside(motorSite)
const besideAntenna = beside(antennaSite)
const observation = antennaSite.clone().add(new Vector3(-0.6, 0, -0.43))

function transfer(seconds: number, start: number) {
  return ease((seconds - start) / 3.3)
}

function setupWalk(t: number) {
  if (t < 1.2) return interpolate(new Vector3(-15.12, 0, -8), pickup, t / 1.2)
  if (t < 5) return interpolate(pickup, besideTable, (t - 1.3) / 3.3)
  if (t < 8) return interpolate(besideTable, pickup, (t - 5) / 2.9)
  if (t < 12.5) return interpolate(pickup, besideAntenna, (t - 8.7) / 3.3)
  return interpolate(besideAntenna, observation, (t - 13) / 1.8)
}

export function sampleSurvey(seconds: number) {
  const t = Math.min(duration, Math.max(0, seconds))
  const phase = phaseAt(t)
  const back = phase.id === "return"
  const progress = back ? 1 - clamp((t - 77) / 17) : clamp((t - 5) / 18)
  const cart = route.getPointAt(progress)
  const tangent = route.getTangentAt(progress)
  const cartYaw =
    Math.atan2(tangent.x, tangent.z) + (back ? Math.PI * ease((t - 75) / 2) : 0)
  const heading = point(Math.sin(cartYaw), Math.cos(cartYaw))
  const pusher = cart.clone().addScaledVector(heading, -0.88)
  const inField = t >= 23 && t < 75
  // Reversing the setup choreography puts each item back on the same shelf.
  const setupTime = t < 59 ? Math.min(16, t - 23) : Math.max(0, 75 - t)
  const tableTravel = transfer(setupTime, 1.3)
  const antennaTravel = transfer(setupTime, 8.7)
  const tableOpen = ease((setupTime - 4.6) / 1.05)
  const antennaOpen = ease((setupTime - 12) / 1.05)
  const walk = inField ? setupWalk(setupTime) : pusher
  const stepDirection = setupWalk(Math.min(16, setupTime + 0.06)).sub(
    setupWalk(Math.max(0, setupTime - 0.06)),
  )
  if (phase.id === "pack") stepDirection.negate()
  const carrying =
    (tableTravel > 0 && tableTravel < 1) ||
    (antennaTravel > 0 && antennaTravel < 1)
  const fieldWalking = stepDirection.length() > 0.003
  const operatorYaw = !inField
    ? cartYaw
    : fieldWalking
      ? Math.atan2(stepDirection.x, stepDirection.z)
      : Math.atan2(antennaSite.x - walk.x, antennaSite.z - walk.z)
  const scanning =
    phase.id === "ambient" || phase.id === "hold" || phase.id === "step"
  const phaseEnd = phases[phases.indexOf(phase) + 1]?.start ?? duration
  const scanProgress = scanning
    ? (t - phase.start) / (phaseEnd - phase.start)
    : 0
  return {
    phase,
    cart,
    cartYaw,
    walk,
    operatorYaw,
    inField,
    carrying,
    tableTravel,
    antennaTravel,
    tableOpen,
    antennaOpen,
    pushing: !inField,
    walking: inField ? fieldWalking : (t > 5 && t < 23) || (t > 75 && t < 94),
    scanning,
    vertical: scanning ? ease((scanProgress - 0.46) / 0.08) : 0,
    motorOn: phase.id === "hold" || phase.id === "step",
    spinning: phase.id === "step",
  }
}
