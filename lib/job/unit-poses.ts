import { BACKFACE_SPACER } from "lib/models/backface-spacer"
import { CONTROLLER_PCB } from "lib/models/controller-pcb"
import { NEMA17 } from "lib/models/nema17-motor"
import { QC_CRADLE } from "lib/models/qc-cradle"
import { BOX_POCKETS, POCKET_FLOOR_YM } from "lib/models/white-mailer-box"
import { QC_BENCH_SPOTS } from "lib/world/bench-spots"
import { Vector3 } from "three"

/**
 * Where parts sit on a finished unit and in its box. The animated steps and
 * the instant stage set-up both use these, so a unit looks the same either way.
 */

/** Spacer (4 mm) plus PCB sit on the back face; screws seat on top of the PCB. */
export const PCB_TOP_ABOVE_MOUNT_FACE_M =
  NEMA17.backfaceHeightM +
  BACKFACE_SPACER.baseHeightM +
  BACKFACE_SPACER.sleeveHeightM +
  CONTROLLER_PCB.thicknessM

/** Spacer on the back face, in motor coordinates. */
export const SPACER_ON_MOTOR = new Vector3(0, NEMA17.backfaceHeightM, 0)

/** PCB on the spacer sleeves, in motor coordinates. */
export const PCB_ON_MOTOR = new Vector3(
  0,
  PCB_TOP_ABOVE_MOUNT_FACE_M - CONTROLLER_PCB.thicknessM,
  0,
)

/** Seated long screw for a bolt-hole corner, in motor coordinates. */
export function getSeatedScrewPosition(corner: {
  xSign: number
  zSign: number
}): Vector3 {
  const halfPitchM = NEMA17.screwPitchM / 2
  return new Vector3(
    corner.xSign * halfPitchM,
    PCB_TOP_ABOVE_MOUNT_FACE_M,
    corner.zSign * halfPitchM,
  )
}

/** Slack offset (motor coordinates) that loops the plugged-in motor cable back along the body. */
export const PLUGGED_CABLE_SLACK = new Vector3(0, 0.014, 0)

/** Motor lying in the QC cradle, back face (PCB) toward +X, in QC bench coordinates. */
export const MOTOR_IN_CRADLE_POSITION = QC_BENCH_SPOTS.cradle
  .clone()
  .add(new Vector3(-0.02, QC_CRADLE.motorAxisHeightM, 0))

/** Mount face 15 mm toward the shaft end of the box's motor pocket, so the PCB and cable fit. */
export const MOTOR_IN_BOX_POSITION = new Vector3(
  BOX_POCKETS.motor.x - 0.015,
  POCKET_FLOOR_YM + NEMA17.faceSizeM / 2,
  BOX_POCKETS.motor.z,
)
