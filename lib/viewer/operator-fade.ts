import type { Operator } from "lib/operator/create-operator"
import { type Material, Vector3 } from "three"

const BODY_RADIUS_M = 0.24
const CAMERA_CLEARANCE_M = 0.6
const FADED_OPACITY = 0.14
const FADE_RATE_PER_SECOND = 8
const SIGHT_LINE_SAMPLES = 24

function getDistanceToSegment(params: {
  point: Vector3
  segmentStart: Vector3
  segmentEnd: Vector3
}): number {
  const { point, segmentStart, segmentEnd } = params
  const segment = segmentEnd.clone().sub(segmentStart)
  const t = Math.min(
    1,
    Math.max(
      0,
      point.clone().sub(segmentStart).dot(segment) / segment.lengthSq(),
    ),
  )
  return point.distanceTo(segmentStart.clone().addScaledVector(segment, t))
}

/**
 * How the operator gets in the way of the shot: `camera_inside` when the
 * camera is inside or right next to the body, `sight_line` when the body sits
 * between the camera and what it is looking at.
 */
export type OperatorObstruction = "none" | "sight_line" | "camera_inside"

export function getOperatorObstruction(params: {
  operator: Operator
  cameraPosition: Vector3
  lookTarget: Vector3
  checkSightLine: boolean
}): OperatorObstruction {
  const { operator, cameraPosition, lookTarget } = params
  operator.head.updateWorldMatrix(true, false)
  const bodyTop = operator.head.localToWorld(new Vector3(0, 0.14, 0))
  const bodyBottom = new Vector3(operator.position.x, 0.3, operator.position.z)
  const cameraDistanceM = getDistanceToSegment({
    point: cameraPosition,
    segmentStart: bodyBottom,
    segmentEnd: bodyTop,
  })
  if (cameraDistanceM < CAMERA_CLEARANCE_M) return "camera_inside"
  if (!params.checkSightLine) return "none"
  // Looking at the operator himself is not being blocked by him.
  const targetDistanceM = getDistanceToSegment({
    point: lookTarget,
    segmentStart: bodyBottom,
    segmentEnd: bodyTop,
  })
  if (targetDistanceM < BODY_RADIUS_M) return "none"
  for (let sample = 1; sample < SIGHT_LINE_SAMPLES; sample++) {
    const point = cameraPosition
      .clone()
      .lerp(lookTarget, sample / SIGHT_LINE_SAMPLES)
    if (
      getDistanceToSegment({
        point,
        segmentStart: bodyBottom,
        segmentEnd: bodyTop,
      }) < BODY_RADIUS_M
    )
      return "sight_line"
  }
  return "none"
}

/** Ease a set of materials toward faded or solid. Returns the new opacity. */
export function updateMaterialOpacity(params: {
  materials: Material[]
  currentOpacity: number
  isFaded: boolean
  dtSeconds: number
}): number {
  const goal = params.isFaded ? FADED_OPACITY : 1
  const step = Math.min(1, params.dtSeconds * FADE_RATE_PER_SECOND)
  const opacity = params.currentOpacity + (goal - params.currentOpacity) * step
  const snappedOpacity = Math.abs(opacity - goal) < 0.01 ? goal : opacity
  const isSolid = snappedOpacity >= 0.999
  for (const material of params.materials) {
    if (material.transparent === isSolid) {
      material.transparent = !isSolid
      material.depthWrite = isSolid
      material.needsUpdate = true
    }
    material.opacity = snappedOpacity
  }
  return snappedOpacity
}
