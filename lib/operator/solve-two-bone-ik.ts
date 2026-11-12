import type { Vector3 } from "three"

/**
 * Place the middle joint of a two-segment limb (thigh/shin, upper arm/forearm)
 * so the end reaches toward `targetPosition`, bending toward `poleDirection`.
 * The end stops at full extension if the target is out of reach.
 */
export function solveTwoBoneIk(params: {
  rootPosition: Vector3
  targetPosition: Vector3
  upperLengthM: number
  lowerLengthM: number
  poleDirection: Vector3
}): { jointPosition: Vector3; endPosition: Vector3 } {
  const { rootPosition, targetPosition, upperLengthM, lowerLengthM } = params
  const reachDirection = targetPosition.clone().sub(rootPosition)
  const distanceM = Math.min(
    Math.max(
      reachDirection.length(),
      Math.abs(upperLengthM - lowerLengthM) + 1e-3,
    ),
    upperLengthM + lowerLengthM - 1e-3,
  )
  reachDirection.normalize()
  const alongM =
    (upperLengthM * upperLengthM -
      lowerLengthM * lowerLengthM +
      distanceM * distanceM) /
    (2 * distanceM)
  const bendM = Math.sqrt(
    Math.max(0, upperLengthM * upperLengthM - alongM * alongM),
  )
  const bendDirection = params.poleDirection
    .clone()
    .addScaledVector(reachDirection, -params.poleDirection.dot(reachDirection))
  if (bendDirection.lengthSq() < 1e-6) bendDirection.set(0, 0, 1)
  bendDirection.normalize()
  return {
    jointPosition: rootPosition
      .clone()
      .addScaledVector(reachDirection, alongM)
      .addScaledVector(bendDirection, bendM),
    endPosition: rootPosition
      .clone()
      .addScaledVector(reachDirection, distanceM),
  }
}
