import { Euler, Quaternion, Vector3 } from "three"
import { FOLDING_TABLE } from "lib/layout/station-layout"

const TOP = FOLDING_TABLE.topHeightM

/**
 * Where things sit on each bench, in that table's local frame (long axis X,
 * operator on the +Z edge). Treat these as read-only; clone before mutating.
 */
export const ASSEMBLY_BENCH_SPOTS = {
  motorTrayCenter: new Vector3(-0.33, TOP, 0.17),
  motorTraySpacingM: 0.055,
  pcbStackBase: new Vector3(-0.14, TOP + 0.004, 0.26),
  pcbStackSpacingM: 0.0045,
  jigTop: new Vector3(0, TOP + 0.03, 0.2),
  screwDish: new Vector3(0.12, TOP, 0.24),
  spacerRest: new Vector3(0.22, TOP, 0.12),
  screwdriverRest: new Vector3(0.32, TOP + 0.0135, 0.085),
}

export const PACK_OUT_BENCH_SPOTS = {
  boxBlankStack: new Vector3(-0.28, TOP, 0.2),
  boxBlankSpacingM: 0.0035,
  boxFolding: new Vector3(0, TOP, 0.2),
  /** Motor assembly lying on its side, waiting to be packed. */
  assemblyRest: new Vector3(0.19, TOP + 0.02115, 0.27),
  bottomFoamStack: new Vector3(0.36, TOP, 0.115),
  topFoamStack: new Vector3(0.36, TOP, 0.275),
  finishedGoods: new Vector3(0.62, TOP, 0.2),
}

/** Screwdriver lying flat on the bench. */
export const SCREWDRIVER_REST_QUATERNION = new Quaternion().setFromEuler(
  new Euler(Math.PI / 2, 0, 0),
)

/** Motor assembly lying on its side, shaft pointing along +X. */
export const MOTOR_ON_SIDE_QUATERNION = new Quaternion().setFromEuler(
  new Euler(0, 0, -Math.PI / 2),
)

export const IDENTITY_QUATERNION = new Quaternion()
