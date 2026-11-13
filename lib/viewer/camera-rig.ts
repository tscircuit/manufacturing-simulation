import { FLOOR_PLAN } from "lib/layout/floor-plan"
import { type PerspectiveCamera, Vector3 } from "three"

export type CameraMode = "overview" | "follow" | "close_up"

const MIN_DISTANCE_M = 0.14
const MAX_DISTANCE_M = 34
const MIN_PITCH_RADIANS = 0.03
const MAX_PITCH_RADIANS = 1.52
const ROOM_CENTER = new Vector3(
  FLOOR_PLAN.widthM / 2,
  0.4,
  FLOOR_PLAN.eastLengthM / 2,
)

/**
 * Orbit camera with three framings: the whole floor, following the operator,
 * and a close-up on the work. The camera sits at `ccwYawRadians` around the
 * target, so it looks along -(sin yaw, cos yaw).
 */
export class CameraRig {
  mode: CameraMode = "follow"
  ccwYawRadians = -1.15
  pitchRadians = 0.5
  distanceM = 6
  readonly target = new Vector3(FLOOR_PLAN.widthM / 2, 1, 3)
  readonly panOffset = new Vector3()
  readonly modeDistancesM: Record<CameraMode, number> = {
    overview: 19,
    follow: 5.2,
    close_up: 0.9,
  }
  /** What the close-up looks at when no task is focusing it. */
  closeUpFocus: (() => Vector3) | null = null

  constructor(private readonly camera: PerspectiveCamera) {}

  setMode(params: { mode: CameraMode; isLandscape: boolean }): void {
    this.mode = params.mode
    this.panOffset.set(0, 0, 0)
    if (params.mode === "overview") {
      this.pitchRadians = 0.95
      this.ccwYawRadians = params.isLandscape ? Math.PI / 2 : 0
    }
  }

  orbit(params: { dxPx: number; dyPx: number }): void {
    this.ccwYawRadians -= params.dxPx * 0.006
    this.pitchRadians = Math.min(
      MAX_PITCH_RADIANS,
      Math.max(MIN_PITCH_RADIANS, this.pitchRadians + params.dyPx * 0.005),
    )
  }

  pan(params: { dxPx: number; dyPx: number }): void {
    const metersPerPx = this.distanceM * 0.0016
    this.panOffset.x -= Math.cos(this.ccwYawRadians) * params.dxPx * metersPerPx
    this.panOffset.z += Math.sin(this.ccwYawRadians) * params.dxPx * metersPerPx
    this.panOffset.y += params.dyPx * metersPerPx
  }

  zoom(factor: number): void {
    const next = this.modeDistancesM[this.mode] * factor
    this.modeDistancesM[this.mode] = Math.min(
      MAX_DISTANCE_M,
      Math.max(MIN_DISTANCE_M, next),
    )
  }

  update(params: {
    dtSeconds: number
    operatorPosition: Vector3
    fallbackCloseUpTarget: Vector3
  }): void {
    let goal: Vector3
    if (this.mode === "overview") goal = ROOM_CENTER.clone()
    else if (this.mode === "follow")
      goal = new Vector3(
        params.operatorPosition.x,
        1.05,
        params.operatorPosition.z,
      )
    else
      goal = this.closeUpFocus
        ? this.closeUpFocus()
        : params.fallbackCloseUpTarget.clone()
    goal.add(this.panOffset)
    this.target.lerp(goal, 1 - Math.exp(-params.dtSeconds * 6))
    this.distanceM +=
      (this.modeDistancesM[this.mode] - this.distanceM) *
      (1 - Math.exp(-params.dtSeconds * 5))
    const horizontalM = this.distanceM * Math.cos(this.pitchRadians)
    this.camera.position.set(
      this.target.x + horizontalM * Math.sin(this.ccwYawRadians),
      this.target.y + this.distanceM * Math.sin(this.pitchRadians),
      this.target.z + horizontalM * Math.cos(this.ccwYawRadians),
    )
    this.camera.lookAt(this.target)
  }
}
