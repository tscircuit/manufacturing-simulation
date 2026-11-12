import { type Mesh, Vector3 } from "three"
import type {
  BodySide,
  Operator,
  OperatorHand,
} from "lib/operator/create-operator"
import { getHandQuaternion } from "lib/operator/hand-pose"
import { OPERATOR_BODY, PINCH_POINT_IN_HAND } from "lib/operator/operator-body"
import { solveTwoBoneIk } from "lib/operator/solve-two-bone-ik"

const UP = new Vector3(0, 1, 0)
/** Palm faces away from the operator while working at a bench. */
const WORK_BACK_OF_HAND_HINT = new Vector3(0, 0, -1)
const KNEE_POLE = new Vector3(0, 0, 1)
const FULL_STRIDE_SPEED_MPS = 1.2
const STRIDE_LENGTH_M = 0.62
const HIP_BEND_SEARCH_STEP_RADIANS = 0.04

const smoothstep = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
/** Fraction to move toward a goal this frame for a given response rate. */
const approachFraction = (params: {
  ratePerSecond: number
  dtSeconds: number
}) => Math.min(1, params.dtSeconds * params.ratePerSecond)

function getShoulderPosition(params: {
  side: BodySide
  hipBendRadians: number
}): Vector3 {
  const { side, hipBendRadians } = params
  return new Vector3(
    side * OPERATOR_BODY.shoulderHalfWidthM,
    OPERATOR_BODY.hipHeightM -
      0.16 * hipBendRadians +
      OPERATOR_BODY.shoulderAboveHipM * Math.cos(hipBendRadians),
    -0.1 * hipBendRadians +
      OPERATOR_BODY.shoulderAboveHipM * Math.sin(hipBendRadians),
  )
}

/** Stretch a unit-height cylinder between two points. */
function placeSegment(params: {
  segment: Mesh
  from: Vector3
  to: Vector3
}): void {
  const { segment, from, to } = params
  const direction = from.clone().sub(to)
  const lengthM = direction.length()
  segment.position.copy(from).add(to).multiplyScalar(0.5)
  segment.quaternion.setFromUnitVectors(
    UP,
    direction.divideScalar(lengthM || 1),
  )
  segment.scale.set(1, lengthM, 1)
}

/** Least hip bend that brings an operator-local target within comfortable reach. */
function getRequiredHipBend(params: {
  side: BodySide
  targetInOperatorFrame: Vector3
}): number {
  for (
    let bend = 0;
    bend < OPERATOR_BODY.maxHipBendRadians;
    bend += HIP_BEND_SEARCH_STEP_RADIANS
  ) {
    const shoulder = getShoulderPosition({
      side: params.side,
      hipBendRadians: bend,
    })
    if (
      shoulder.distanceTo(params.targetInOperatorFrame) <=
      OPERATOR_BODY.comfortableReachM
    )
      return bend
  }
  return OPERATOR_BODY.maxHipBendRadians
}

/** Where the wrist must go (operator frame) for the pinch point to land on the hand's target. */
function getWristTarget(hand: OperatorHand, operator: Operator): Vector3 {
  const workQuaternion = getHandQuaternion({
    fingerDirection: hand.fingerDirection,
    backOfHandHint: WORK_BACK_OF_HAND_HINT,
  })
  const targetInOperatorFrame = operator.group.worldToLocal(
    hand.targetPosition.clone(),
  )
  return targetInOperatorFrame.sub(
    PINCH_POINT_IN_HAND.clone().applyQuaternion(workQuaternion),
  )
}

function updateHandTargets(operator: Operator, dtSeconds: number): number {
  let hipBendGoal = 0
  for (const hand of operator.hands) {
    if (hand.trackTarget) hand.targetPosition.copy(hand.trackTarget())
    hand.reachBlend +=
      ((hand.isReaching ? 1 : 0) - hand.reachBlend) *
      approachFraction({ ratePerSecond: 7, dtSeconds })
    hand.fingerDirection
      .lerp(
        hand.targetFingerDirection,
        approachFraction({ ratePerSecond: 6, dtSeconds }),
      )
      .normalize()
    hand.fingerCurl +=
      (hand.targetFingerCurl - hand.fingerCurl) *
      approachFraction({ ratePerSecond: 14, dtSeconds })
    if (!hand.isReaching) continue
    const wristTarget = getWristTarget(hand, operator)
    const bend = getRequiredHipBend({
      side: hand.side,
      targetInOperatorFrame: wristTarget,
    })
    hipBendGoal = Math.max(
      hipBendGoal,
      bend * Math.min(1, hand.reachBlend * 1.5),
    )
  }
  return hipBendGoal
}

function poseLegs(
  params: { hipYM: number; hipZM: number },
  operator: Operator,
): void {
  const stride = operator.gaitBlend
  const swing = Math.sin(operator.gaitPhaseRadians)
  const lift = Math.cos(operator.gaitPhaseRadians)
  for (const leg of operator.legs) {
    const hipJoint = new Vector3(
      leg.side * OPERATOR_BODY.hipHalfWidthM,
      params.hipYM,
      params.hipZM,
    )
    const ankleTarget = new Vector3(
      leg.side * OPERATOR_BODY.hipHalfWidthM,
      OPERATOR_BODY.ankleHeightM + 0.09 * stride * Math.max(0, leg.side * lift),
      leg.side * 0.3 * stride * swing,
    )
    const { jointPosition: knee, endPosition: ankle } = solveTwoBoneIk({
      rootPosition: hipJoint,
      targetPosition: ankleTarget,
      upperLengthM: OPERATOR_BODY.thighLengthM,
      lowerLengthM: OPERATOR_BODY.shinLengthM,
      poleDirection: KNEE_POLE,
    })
    placeSegment({ segment: leg.thigh, from: hipJoint, to: knee })
    placeSegment({ segment: leg.shin, from: knee, to: ankle })
    leg.hip.position.copy(hipJoint)
    leg.knee.position.copy(knee)
    // Shoe sole sits on the floor when the ankle is at rest height.
    leg.foot.position.set(ankle.x, ankle.y - 0.06, ankle.z + 0.055)
  }
}

function poseArm(hand: OperatorHand, operator: Operator): void {
  const shoulder = getShoulderPosition({
    side: hand.side,
    hipBendRadians: operator.hipBendRadians,
  })
  const armLengthM =
    OPERATOR_BODY.upperArmLengthM + OPERATOR_BODY.forearmLengthM
  const armSwingM =
    -hand.side * 0.2 * operator.gaitBlend * Math.sin(operator.gaitPhaseRadians)
  const relaxedWrist = new Vector3(
    shoulder.x + hand.side * 0.05,
    shoulder.y - armLengthM * 0.985,
    shoulder.z + 0.04 + armSwingM,
  )
  const reach = smoothstep(clamp01(hand.reachBlend))
  const wristTarget = relaxedWrist.lerp(getWristTarget(hand, operator), reach)
  const { jointPosition: elbow, endPosition: wrist } = solveTwoBoneIk({
    rootPosition: shoulder,
    targetPosition: wristTarget,
    upperLengthM: OPERATOR_BODY.upperArmLengthM,
    lowerLengthM: OPERATOR_BODY.forearmLengthM,
    poleDirection: new Vector3(hand.side * 0.45, -0.3, -1),
  })
  hand.shoulder.position.copy(shoulder)
  hand.wrist.position.copy(wrist)
  placeSegment({ segment: hand.upperArm, from: shoulder, to: elbow })
  placeSegment({ segment: hand.forearm, from: elbow, to: wrist })
  hand.elbow.position.copy(elbow)
  hand.hand.position.copy(wrist)
  const relaxedQuaternion = getHandQuaternion({
    fingerDirection: wrist.clone().sub(elbow).normalize(),
    backOfHandHint: new Vector3(-hand.side, 0, 0),
  })
  const workQuaternion = getHandQuaternion({
    fingerDirection: hand.fingerDirection,
    backOfHandHint: WORK_BACK_OF_HAND_HINT,
  })
  hand.hand.quaternion.copy(relaxedQuaternion).slerp(workQuaternion, reach)
  for (const [index, finger] of hand.fingers.entries()) {
    // The little finger curls a touch more than the index.
    const fingerCurl = hand.fingerCurl * (1 + index * 0.06)
    finger.proximal.rotation.x = -fingerCurl * 0.9
    finger.distal.rotation.x = -fingerCurl * 1.05
  }
  hand.thumb.rotation.set(-0.35 - hand.fingerCurl * 0.5, 0, -hand.side * 0.35)
}

/** Advance gait, hip bend and both arms toward their targets, then pose every mesh. */
export function updateOperatorPose(
  operator: Operator,
  dtSeconds: number,
): void {
  operator.group.position.set(operator.position.x, 0, operator.position.z)
  operator.group.rotation.y = operator.ccwYawRadians
  operator.group.updateMatrixWorld(true)

  const strideGoal = Math.min(1, operator.walkSpeedMps / FULL_STRIDE_SPEED_MPS)
  operator.gaitBlend +=
    (strideGoal - operator.gaitBlend) *
    approachFraction({ ratePerSecond: 8, dtSeconds })
  operator.gaitPhaseRadians +=
    ((operator.walkSpeedMps * dtSeconds) / STRIDE_LENGTH_M) * Math.PI

  const hipBendGoal = updateHandTargets(operator, dtSeconds)
  operator.hipBendRadians +=
    (hipBendGoal - operator.hipBendRadians) *
    approachFraction({ ratePerSecond: 5, dtSeconds })
  const bend = operator.hipBendRadians
  const stride = operator.gaitBlend
  const hipYM =
    OPERATOR_BODY.hipHeightM -
    0.012 * stride -
    0.022 * stride * Math.abs(Math.sin(operator.gaitPhaseRadians)) -
    0.16 * bend
  const hipZM = -0.1 * bend
  operator.torso.position.set(0, hipYM, hipZM)
  operator.torso.rotation.x = bend
  operator.head.rotation.x = -bend * 0.4

  poseLegs({ hipYM, hipZM }, operator)
  for (const hand of operator.hands) poseArm(hand, operator)
  operator.group.updateMatrixWorld(true)
}
