import { WORK_TABLE } from "lib/layout/station-layout"
import { Euler, Quaternion, Vector3 } from "three"

const TOP = WORK_TABLE.topHeightM

/**
 * Where things sit on each bench, in that table's local frame (long axis X;
 * the operator stands on the +Z edge). Treat these as read-only and clone
 * before mutating.
 */
export const ASSEMBLY_BENCH_SPOTS = {
  /** Everything here is within reach of one standing spot in front of the jig. */
  spacerBasket: new Vector3(0.14, TOP, 0.31),
  motorFoamStand: new Vector3(0.43, TOP, 0.12),
  jigTop: new Vector3(0, TOP + 0.03, 0.2),
  finishedRack: new Vector3(-0.47, TOP, 0.12),
  longScrewBin: new Vector3(0.115, TOP, 0),
  usedScrewBin: new Vector3(0, TOP, 0),
  cableBin: new Vector3(-0.115, TOP, 0),
  screwdriverRest: new Vector3(-0.235, TOP + 0.02, -0.06),
  /** Three stacks of controller PCBs, the first one nearest the jig. */
  pcbStackBases: [
    new Vector3(-0.09, TOP + 0.004, 0.3),
    new Vector3(-0.16, TOP + 0.004, 0.3),
    new Vector3(-0.23, TOP + 0.004, 0.3),
  ],
  pcbStackSpacingM: 0.0045,
  /** Empty spacer tubs end up here after a refill. */
  emptyTubs: new Vector3(0.66, TOP, -0.17),
}

export const QC_BENCH_SPOTS = {
  laptop: new Vector3(0.12, TOP, -0.13),
  cradle: new Vector3(-0.12, TOP, 0.2),
  chargingStation: new Vector3(-0.25, TOP, -0.28),
  dataPlugRest: new Vector3(-0.03, TOP + 0.0031, 0.3),
  powerPlugRest: new Vector3(-0.22, TOP + 0.0031, 0.3),
  incomingRack: new Vector3(0.45, TOP, 0.13),
  readyRack: new Vector3(-0.49, TOP, 0.12),
}

export const PACK_OUT_BENCH_SPOTS = {
  incomingRack: new Vector3(0.56, TOP, 0.12),
  boxStacks: [
    new Vector3(0.62, TOP, -0.25),
    new Vector3(0.42, TOP, -0.25),
    new Vector3(0.22, TOP, -0.25),
    new Vector3(0.02, TOP, -0.25),
    new Vector3(-0.18, TOP, -0.25),
  ],
  packing: new Vector3(0.0, TOP, 0.17),
  cableCoilStacks: [
    new Vector3(-0.17, TOP, 0.06),
    new Vector3(-0.23, TOP, 0.06),
    new Vector3(-0.29, TOP, 0.06),
  ],
  chargerStacks: [
    new Vector3(-0.18, TOP, 0.15),
    new Vector3(-0.24, TOP, 0.15),
    new Vector3(-0.3, TOP, 0.15),
  ],
  labelSheets: new Vector3(-0.55, TOP, 0.2),
  tote: new Vector3(-0.52, TOP, -0.15),
}

export const SHIP_READY_BENCH_SPOTS = {
  carton: new Vector3(0, TOP, 0),
  cartonLabelRest: new Vector3(-0.27, TOP, 0.285),
  incomingTote: new Vector3(0.56, TOP, 0.1),
}

export const PRINTER_BENCH_SPOTS = {
  p2s: new Vector3(-0.45, TOP, 0),
  h2s: new Vector3(0.35, TOP, -0.05),
  emptyTubs: new Vector3(-0.075, TOP, 0.27),
}

export const LABEL_BENCH_SPOTS = {
  inkjetPrinter: new Vector3(0, TOP, -0.12),
  printedSheets: new Vector3(0, TOP, 0.2),
  blankSheets: new Vector3(0.5, TOP, 0.1),
}

/** Screwdriver lying flat on the bench, handle toward the operator. */
export const SCREWDRIVER_REST_QUATERNION = new Quaternion().setFromEuler(
  new Euler(Math.PI / 2, 0, 0),
)

/**
 * Motor lying on its side with the back face (PCB) toward +X. The PCB power
 * port then faces up and the data port faces -Z.
 */
export const MOTOR_ON_SIDE_QUATERNION = new Quaternion().setFromEuler(
  new Euler(0, 0, -Math.PI / 2),
)

/**
 * Motor lying in its box pocket: shaft along -X, cable socket facing up and
 * the PCB power port toward the front of the box.
 */
export const MOTOR_IN_BOX_QUATERNION = new Quaternion().setFromEuler(
  new Euler(Math.PI / 2, 0, -Math.PI / 2),
)

/** Cable plug lying flat with its wire pointing along +X. */
export const PLUG_LYING_QUATERNION = new Quaternion().setFromEuler(
  new Euler(Math.PI / 2, 0, -Math.PI / 2),
)

/** A screw lying on its side. */
export const SCREW_LYING_QUATERNION = new Quaternion().setFromAxisAngle(
  new Vector3(0, 0, 1),
  Math.PI / 2,
)

export const IDENTITY_QUATERNION = new Quaternion()
