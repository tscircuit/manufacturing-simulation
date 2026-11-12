import { Euler, Quaternion, Vector3 } from "three"
import { FOLDING_TABLE } from "lib/layout/station-layout"

const TOP = FOLDING_TABLE.topHeightM

/**
 * Where things sit on each bench, in that table's local frame (long axis X,
 * which points upstream along the line; operator on the +Z edge). Treat these
 * as read-only and clone before mutating.
 */
export const SPACER_BENCH_SPOTS = {
  basket: new Vector3(0, TOP, 0.12),
}

export const ASSEMBLY_BENCH_SPOTS = {
  motorTrayCenter: new Vector3(0.42, TOP, 0.16),
  motorTraySpacingM: 0.055,
  spacerRest: new Vector3(0.22, TOP, 0.27),
  jigTop: new Vector3(0, TOP + 0.03, 0.2),
  longScrewBin: new Vector3(0.08, TOP, -0.02),
  usedScrewBin: new Vector3(-0.07, TOP, -0.02),
  screwdriverRest: new Vector3(-0.17, TOP + 0.0135, 0.07),
  pcbStackBase: new Vector3(-0.3, TOP + 0.004, 0.22),
  pcbStackSpacingM: 0.0045,
  motorCableStart: new Vector3(-0.5, TOP, 0.16),
}

export const QC_BENCH_SPOTS = {
  laptop: new Vector3(0.12, TOP, -0.13),
  cradle: new Vector3(-0.12, TOP, 0.2),
  chargingStation: new Vector3(-0.4, TOP, -0.1),
  dataPlugRest: new Vector3(-0.03, TOP + 0.0031, 0.28),
  powerPlugRest: new Vector3(-0.24, TOP + 0.0031, 0.28),
}

export const PACK_OUT_BENCH_SPOTS = {
  boxStack: new Vector3(0.5, TOP, 0.05),
  packing: new Vector3(0.02, TOP, 0.17),
  cableCoilStack: new Vector3(-0.33, TOP, 0.12),
  chargerStack: new Vector3(-0.33, TOP, 0.29),
  labelSheet: new Vector3(-0.56, TOP, 0.2),
  inkjetPrinter: new Vector3(-0.56, TOP, -0.2),
}

export const SHIP_READY_BENCH_SPOTS = {
  outgoing: new Vector3(0.2, TOP, 0.05),
}

/**
 * Motor lying in its box pocket: shaft along -X, cable socket facing up and
 * the PCB power port toward the front of the box.
 */
export const MOTOR_IN_BOX_QUATERNION = new Quaternion().setFromEuler(
  new Euler(Math.PI / 2, 0, -Math.PI / 2),
)

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
