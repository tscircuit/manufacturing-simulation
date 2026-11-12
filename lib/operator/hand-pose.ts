import { Matrix4, Quaternion, type Vector3 } from "three"
import type { OperatorHand } from "lib/operator/create-operator"
import { PINCH_POINT_IN_HAND } from "lib/operator/operator-body"

/** World position of a hand's pinch point. */
export function getPinchWorldPosition(hand: OperatorHand): Vector3 {
  hand.hand.updateWorldMatrix(true, false)
  return hand.hand.localToWorld(PINCH_POINT_IN_HAND.clone())
}

/**
 * Orientation for a hand whose fingers point along `fingerDirection` (the
 * hand's local -Y) with the back of the hand toward `backOfHandHint`.
 */
export function getHandQuaternion(params: {
  fingerDirection: Vector3
  backOfHandHint: Vector3
}): Quaternion {
  const yAxis = params.fingerDirection.clone().negate()
  const xAxis = yAxis.clone().cross(params.backOfHandHint).normalize()
  const zAxis = xAxis.clone().cross(yAxis)
  return new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(xAxis, yAxis, zAxis),
  )
}
