import { createBackfaceSpacer } from "lib/models/backface-spacer"
import {
  createControllerPcb,
  STATUS_LED_COLORS,
} from "lib/models/controller-pcb"
import {
  createNema17Motor,
  NEMA17,
  createM3Screw,
  LONG_SCREW_SHANK_M,
} from "lib/models/nema17-motor"
import { createQcCradle, QC_CRADLE } from "lib/models/qc-cradle"
import { createQcLaptop } from "lib/models/qc-laptop"
import { type Vec3Tuple } from "lib/scene/primitives"
import {
  BLACK_PLASTIC_MATERIAL,
  STEEL_MATERIAL,
} from "lib/scene/shared-materials"
import { CatmullRomCurve3, Group, Mesh, TubeGeometry, Vector3 } from "three"
import { box, paint, rod, sign } from "./shapes"

const graphite = paint(0x343c3d)
const rubber = paint(0x242b2c)
const rim = paint(0x86918d)
const orange = paint(0xe37b39)
const birch = paint(0xd6ab70)
const greenScreen = paint(0x91c7a1)
const metal = STEEL_MATERIAL

function lead(group: Group, points: Vec3Tuple[], radius = 0.0025) {
  const path = new CatmullRomCurve3(points.map((p) => new Vector3(...p)))
  const mesh = new Mesh(new TubeGeometry(path, 16, radius, 5, false), rubber)
  group.add(mesh)
  return mesh
}

// Uline H-2504BL: 45 × 25 × 33 in, with two deep trays and 5 in casters.
// Local +Z is the rolling direction and the push handle is at the rear.
export function createSurveyCart() {
  const group = new Group()
  const wheels: Group[] = []
  for (const y of [0.23, 0.77]) {
    box(group, graphite, [0.63, 0.032, 0.91], [0, y, 0.045])
    for (const x of [-0.308, 0.308]) {
      box(group, graphite, [0.024, 0.074, 0.92], [x, y + 0.028, 0.045])
      box(group, rubber, [0.03, 0.01, 0.925], [x, y + 0.064, 0.045])
    }
    for (const z of [-0.407, 0.497])
      box(group, graphite, [0.63, 0.071, 0.025], [0, y + 0.028, z])
  }
  for (const x of [-0.265, 0.265]) {
    for (const z of [-0.35, 0.43]) {
      box(group, graphite, [0.06, 0.52, 0.06], [x, 0.51, z])
      box(group, metal, [0.072, 0.017, 0.096], [x, 0.201, z])
      for (const dx of [-0.035, 0.035])
        box(group, rim, [0.011, 0.132, 0.039], [x + dx, 0.127, z])
      const wheel = new Group()
      wheel.position.set(x, 0.0635, z)
      rod(wheel, rubber, [-0.03, 0, 0], [0.03, 0, 0], 0.0635, 20)
      for (const side of [-1, 1]) {
        rod(wheel, rim, [side * 0.03, 0, 0], [side * 0.033, 0, 0], 0.039, 16)
        box(wheel, graphite, [0.003, 0.009, 0.029], [side * 0.034, 0, 0.013])
      }
      wheels.push(wheel)
      group.add(wheel)
    }
    rod(group, graphite, [x, 0.785, -0.4], [x, 0.817, -0.608], 0.027)
  }
  rod(group, rubber, [-0.271, 0.816, -0.608], [0.271, 0.816, -0.608], 0.026, 14)
  for (const side of [-1, 1])
    sign(group, "ULINE", 0.19, 0.05, [side * 0.324, 0.803, 0.06], {
      yaw: (side * Math.PI) / 2,
      background: "#f2eee2",
      color: "#182a36",
    })
  // Receiver transport case stays with the cart while the instruments are deployed.
  box(group, orange, [0.3, 0.15, 0.4], [-0.13, 0.33, 0.07])
  box(group, graphite, [0.306, 0.014, 0.404], [-0.13, 0.365, 0.07])
  for (const z of [-0.07, 0.2])
    box(group, rubber, [0.022, 0.052, 0.045], [-0.286, 0.37, z])
  return { group, wheels }
}

// The motor origin projects onto the centre of the wooden table.
export function createMotorTable() {
  const group = new Group()
  const top = new Group()
  group.add(top)
  const surface = box(top, birch, [0.78, 0.024, 0.49], [0, -0.012, 0])
  const legs = new Group()
  for (const x of [-0.235, 0.235]) {
    for (const z of [-0.15, 0.15])
      rod(legs, birch, [x, -0.02, z], [x * 1.32, -0.79, z * 1.35], 0.015)
    rod(legs, birch, [x * 1.24, -0.56, -0.185], [x * 1.24, -0.56, 0.185], 0.01)
  }
  top.add(legs, createQcCradle())
  const motor = createNema17Motor()
  const board = createControllerPcb()
  const spacer = createBackfaceSpacer()
  spacer.position.y = NEMA17.backfaceHeightM
  board.group.position.y = NEMA17.backfaceHeightM + 0.004
  motor.group.add(spacer, board.group)
  for (const screw of motor.stockScrews) {
    screw.group.visible = false
    const long = createM3Screw({ shankLengthM: LONG_SCREW_SHANK_M })
    long.position.copy(screw.group.position)
    long.position.y = board.group.position.y + 0.0016
    motor.group.add(long)
  }
  motor.group.rotation.x = -Math.PI / 2
  motor.group.position.set(0, QC_CRADLE.motorAxisHeightM, 0.016)
  box(motor.rotor, orange, [0.024, 0.0025, 0.003], [0.01, -0.018, 0])
  top.add(motor.group)
  const laptop = createQcLaptop()
  laptop.group.position.set(0.21, 0, -0.015)
  top.add(laptop.group)
  const lid = laptop.display.parent!
  const laptopTitle = sign(
    lid as Group,
    "NEMA17 MOTOR CONTROL",
    0.242,
    0.027,
    [0, 0.154, 0.0014],
  )
  const modes = ["USB disconnected", "Holding", "Stepping"].map((label) =>
    sign(lid as Group, label, 0.225, 0.042, [0, 0.097, 0.0014], {
      color: "#e0d7ad",
    }),
  )
  box(top, graphite, [0.082, 0.034, 0.145], [-0.18, 0.017, 0.025])
  sign(top, "PD", 0.048, 0.019, [-0.18, 0.018, 0.099], {
    background: "#273b39",
  })
  const connections = new Group()
  lead(connections, [
    [-0.163, 0.019, 0.098],
    [-0.135, 0.005, 0.129],
    [-0.09, 0.007, -0.039],
    [-0.023, 0.031, -0.032],
  ])
  lead(connections, [
    [0.059, 0.01, -0.038],
    [0.049, 0.004, -0.094],
    [-0.038, 0.007, -0.09],
    [-0.023, 0.036, -0.017],
  ])
  top.add(connections)
  lead(
    top,
    [
      [0.02, 0.04, 0.0],
      [0.041, 0.055, 0.0],
      [0.043, 0.052, -0.031],
      [0.019, 0.035, -0.029],
    ],
    0.003,
  )
  return {
    group,
    update(open: number, on: boolean, spinning: boolean, time: number) {
      legs.scale.y = Math.max(0.015, open)
      surface.scale.x = 0.79 + 0.21 * open
      lid.rotation.x = 1.53 - 1.88 * open
      board.statusLed.material.color.setHex(
        !on
          ? STATUS_LED_COLORS.off
          : spinning
            ? STATUS_LED_COLORS.running
            : STATUS_LED_COLORS.idle,
      )
      motor.rotor.rotation.y = spinning ? (time - 51) * 13 : 0
      laptopTitle.visible = open > 0.95
      for (const [i, label] of modes.entries())
        label.visible = open > 0.95 && i === (!on ? 0 : spinning ? 2 : 1)
      connections.visible = on
      laptop.display.material.color.setHex(on ? 0x276b70 : 0x203337)
    },
  }
}

export function createSurveyAntenna() {
  const group = new Group()
  const mast = new Group()
  group.add(mast)
  rod(mast, metal, [0, 0.24, 0], [0, 0.96, 0], 0.016)
  rod(mast, graphite, [0, 0.82, 0], [0, 1.18, 0], 0.011)
  rod(mast, orange, [0, 0.8, 0], [0, 0.84, 0], 0.024)
  const legs: Group[] = []
  for (let i = 0; i < 3; i++) {
    const joint = new Group()
    joint.position.y = 0.52
    joint.rotation.y = (i * Math.PI * 2) / 3
    const leg = new Group()
    rod(leg, graphite, [0, 0, 0], [0, -0.6, 0], 0.01)
    rod(leg, rubber, [0, -0.565, 0], [0, -0.6, 0], 0.017)
    joint.add(leg)
    group.add(joint)
    legs.push(leg)
  }
  // Rotate the two cones about the line of sight to the motor (+X).
  const antenna = new Group()
  antenna.position.y = 1.18
  for (const side of [-1, 1]) {
    const rimPoints: Vec3Tuple[] = []
    for (let i = 0; i < 8; i++) {
      const phi = (Math.PI * i) / 4
      const end: Vec3Tuple = [
        0.08 * Math.cos(phi),
        0.08 * Math.sin(phi),
        side * 0.205,
      ]
      rod(antenna, metal, [0, 0, side * 0.014], end, 0.003)
      rimPoints.push(end)
    }
    for (let j = 0; j < 8; j++)
      rod(antenna, metal, rimPoints[j], rimPoints[(j + 1) % 8], 0.0023)
  }
  rod(antenna, BLACK_PLASTIC_MATERIAL, [0, 0, -0.035], [0, 0, 0.035], 0.017)
  mast.add(antenna)
  box(mast, orange, [0.113, 0.077, 0.027], [0, 0.7, 0.032])
  box(mast, greenScreen, [0.078, 0.049, 0.002], [-0.008, 0.7, 0.047])
  box(mast, graphite, [0.013, 0.023, 0.003], [0.041, 0.7, 0.047])
  lead(
    mast,
    [
      [0, 1.18, 0],
      [-0.065, 1.13, 0.009],
      [-0.047, 0.94, 0.019],
      [-0.045, 0.75, 0.034],
    ],
    0.0025,
  )
  return {
    group,
    update(open: number, vertical: number) {
      for (const leg of legs) leg.rotation.x = -0.07 - 0.46 * open
      antenna.rotation.x = (-vertical * Math.PI) / 2
    },
  }
}
