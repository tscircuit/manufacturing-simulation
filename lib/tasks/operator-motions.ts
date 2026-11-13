import { getStationStandPose } from "lib/layout/get-station-stand-pose"
import type { Station } from "lib/layout/station-layout"
import { findPath } from "lib/navigation/find-path"
import type { OperatorHand } from "lib/operator/create-operator"
import { getPinchWorldPosition } from "lib/operator/hand-pose"
import {
  OPERATOR_WALK_SPEED_MPS,
  RELAXED_FINGER_CURL,
  RELAXED_FINGER_DIRECTION,
} from "lib/operator/operator-body"
import type { SimContext } from "lib/simulation/sim-context"
import { type SimTask, tween, waitSeconds } from "lib/tasks/coroutines"
import { type Object3D, Quaternion, Vector3 } from "three"

const TURN_RATE_WHILE_WALKING_RADIANS_PER_SECOND = 6
const TURN_RATE_IN_PLACE_RADIANS_PER_SECOND = 4
const WAYPOINT_ARRIVAL_M = 0.08
const DESTINATION_ARRIVAL_M = 0.012
const YAW_ARRIVAL_RADIANS = 0.01

/** Signed shortest turn from one heading to another, in (-π, π]. */
export function getAngleDifferenceRadians(params: {
  fromRadians: number
  toRadians: number
}): number {
  let difference = (params.toRadians - params.fromRadians) % (Math.PI * 2)
  if (difference > Math.PI) difference -= Math.PI * 2
  if (difference < -Math.PI) difference += Math.PI * 2
  return difference
}

const clamp = (params: { value: number; limit: number }) =>
  Math.max(-params.limit, Math.min(params.limit, params.value))

/** A function returning the current world position of a point fixed to an object. */
export function trackObjectPoint(params: {
  object: Object3D
  localPoint?: Vector3
}): () => Vector3 {
  const { object, localPoint } = params
  return () => {
    object.updateWorldMatrix(true, false)
    return object.localToWorld(localPoint ? localPoint.clone() : new Vector3())
  }
}

/** Walk around obstacles to (x, z), then optionally turn to a final heading. */
export function* walkTo(
  params: { x: number; z: number; finalCcwYawRadians?: number },
  ctx: SimContext,
): SimTask {
  const { operator } = ctx
  const path = findPath(
    {
      from: { x: operator.position.x, z: operator.position.z },
      to: { x: params.x, z: params.z },
    },
    ctx.navGrid,
  )
  for (const [index, waypoint] of path.entries()) {
    const isLastWaypoint = index === path.length - 1
    for (;;) {
      const dtSeconds = yield
      const dx = waypoint.x - operator.position.x
      const dz = waypoint.z - operator.position.z
      const distanceM = Math.hypot(dx, dz)
      if (
        distanceM <
        (isLastWaypoint ? DESTINATION_ARRIVAL_M : WAYPOINT_ARRIVAL_M)
      )
        break
      const turnRadians = getAngleDifferenceRadians({
        fromRadians: operator.ccwYawRadians,
        toRadians: Math.atan2(dx, dz),
      })
      operator.ccwYawRadians += clamp({
        value: turnRadians,
        limit: TURN_RATE_WHILE_WALKING_RADIANS_PER_SECOND * dtSeconds,
      })
      // Slow down while turning sharply and when arriving.
      let speedMps =
        OPERATOR_WALK_SPEED_MPS *
        Math.max(0.15, Math.cos(clamp({ value: turnRadians, limit: 1.4 })))
      if (isLastWaypoint) speedMps = Math.min(speedMps, distanceM * 4 + 0.12)
      const stepM = Math.min(distanceM, speedMps * dtSeconds)
      operator.position.x += (dx / distanceM) * stepM
      operator.position.z += (dz / distanceM) * stepM
      operator.walkSpeedMps = speedMps
    }
  }
  operator.walkSpeedMps = 0
  if (params.finalCcwYawRadians === undefined) return
  for (;;) {
    const dtSeconds = yield
    const turnRadians = getAngleDifferenceRadians({
      fromRadians: operator.ccwYawRadians,
      toRadians: params.finalCcwYawRadians,
    })
    if (Math.abs(turnRadians) < YAW_ARRIVAL_RADIANS) {
      operator.ccwYawRadians = params.finalCcwYawRadians
      return
    }
    operator.ccwYawRadians += clamp({
      value: turnRadians,
      limit: TURN_RATE_IN_PLACE_RADIANS_PER_SECOND * dtSeconds,
    })
  }
}

export function* walkToStation(station: Station, ctx: SimContext): SimTask {
  const pose = getStationStandPose(station)
  yield* walkTo(
    { x: pose.x, z: pose.z, finalCcwYawRadians: pose.ccwYawRadians },
    ctx,
  )
}

/** Move a hand's pinch point to a moving target along a small arc, then keep it there. */
export function* reachHand(params: {
  hand: OperatorHand
  getTarget: () => Vector3
  durationSeconds?: number
  arcHeightM?: number
}): SimTask {
  const { hand, getTarget } = params
  const arcHeightM = params.arcHeightM ?? 0.04
  const startPosition = getPinchWorldPosition(hand)
  hand.isReaching = true
  hand.trackTarget = null
  yield* tween({
    durationSeconds: params.durationSeconds ?? 0.55,
    onProgress: (progress) => {
      hand.targetPosition.lerpVectors(startPosition, getTarget(), progress)
      hand.targetPosition.y += Math.sin(Math.PI * progress) * arcHeightM
    },
  })
  hand.trackTarget = getTarget
}

/** Reach for a point on an object and close the fingers on it. */
export function* grabObject(params: {
  hand: OperatorHand
  object: Object3D
  localGripPoint?: Vector3
  fingerCurl?: number
  durationSeconds?: number
}): SimTask {
  yield* reachHand({
    hand: params.hand,
    getTarget: trackObjectPoint({
      object: params.object,
      localPoint: params.localGripPoint,
    }),
    durationSeconds: params.durationSeconds,
  })
  params.hand.targetFingerCurl = params.fingerCurl ?? 0.9
  yield* waitSeconds(0.2)
}

/** Open the fingers and let the arm relax. */
export function* releaseHand(hand: OperatorHand): SimTask {
  hand.targetFingerCurl = RELAXED_FINGER_CURL
  yield* waitSeconds(0.16)
  hand.trackTarget = null
  hand.isReaching = false
  hand.heldObject = null
  hand.targetFingerDirection.copy(RELAXED_FINGER_DIRECTION)
}

/** Parent an object to the hand so it follows the hand while walking. */
export function holdInHand(params: {
  hand: OperatorHand
  object: Object3D
}): void {
  params.hand.hand.attach(params.object)
  params.object.userData.isCarried = true
  params.hand.heldObject = params.object
}

/** Bring a hand to a comfortable carrying position in front of the body. */
export function* bringHandToCarryPose(
  hand: OperatorHand,
  ctx: SimContext,
): SimTask {
  const { operator } = ctx
  yield* reachHand({
    hand,
    getTarget: () => {
      operator.group.updateWorldMatrix(true, false)
      return operator.group.localToWorld(
        new Vector3(hand.side * 0.17, 1.03, 0.3),
      )
    },
    durationSeconds: 0.55,
    arcHeightM: 0.02,
  })
}

/**
 * Move an object to a pose in `parent`'s frame, interpolating in world space.
 * If `hand` is given, the hand stays on the object the whole way.
 */
export function* moveObject(
  params: {
    object: Object3D
    hand?: OperatorHand
    parent: Object3D
    localPosition: Vector3
    localQuaternion: Quaternion
    durationSeconds?: number
    arcHeightM?: number
  },
  ctx: SimContext,
): SimTask {
  const { object, hand, parent, localPosition, localQuaternion } = params
  // In transit, parts hang off the world root (identity transform) so a reset clears them.
  ctx.world.root.attach(object)
  object.userData.isCarried = false
  const startPosition = object.position.clone()
  const startQuaternion = object.quaternion.clone()
  parent.updateWorldMatrix(true, false)
  const endPosition = parent.localToWorld(localPosition.clone())
  const endQuaternion = parent
    .getWorldQuaternion(new Quaternion())
    .multiply(localQuaternion)
  if (hand) {
    object.updateWorldMatrix(true, false)
    const gripPoint = object.worldToLocal(getPinchWorldPosition(hand))
    hand.trackTarget = trackObjectPoint({ object, localPoint: gripPoint })
    hand.isReaching = true
  }
  const arcHeightM = params.arcHeightM ?? 0
  yield* tween({
    durationSeconds: params.durationSeconds ?? 0.7,
    onProgress: (progress) => {
      object.position.lerpVectors(startPosition, endPosition, progress)
      object.position.y += Math.sin(Math.PI * progress) * arcHeightM
      object.quaternion.copy(startQuaternion).slerp(endQuaternion, progress)
    },
  })
  parent.attach(object)
  object.position.copy(localPosition)
  object.quaternion.copy(localQuaternion)
}

/** Lift an object straight up, carry it across, and lower it straight down. */
export function* liftAndPlace(
  params: {
    object: Object3D
    hand: OperatorHand
    parent: Object3D
    localPosition: Vector3
    localQuaternion: Quaternion
    liftHeightM: number
    travelSeconds?: number
  },
  ctx: SimContext,
): SimTask {
  const { object, hand, parent, localPosition, localQuaternion } = params
  object.updateWorldMatrix(true, false)
  const startPosition = object.getWorldPosition(new Vector3())
  const startQuaternion = object.getWorldQuaternion(new Quaternion())
  parent.updateWorldMatrix(true, false)
  const endPosition = parent.localToWorld(localPosition.clone())
  const endQuaternion = parent
    .getWorldQuaternion(new Quaternion())
    .multiply(localQuaternion)
  const carryHeightM =
    Math.max(startPosition.y, endPosition.y) + params.liftHeightM
  yield* moveObject(
    {
      object,
      hand,
      parent: ctx.world.root,
      localPosition: new Vector3(
        startPosition.x,
        carryHeightM,
        startPosition.z,
      ),
      localQuaternion: startQuaternion,
      durationSeconds: 0.4,
    },
    ctx,
  )
  yield* moveObject(
    {
      object,
      hand,
      parent: ctx.world.root,
      localPosition: new Vector3(endPosition.x, carryHeightM, endPosition.z),
      localQuaternion: endQuaternion,
      durationSeconds: params.travelSeconds ?? 0.8,
    },
    ctx,
  )
  yield* moveObject(
    {
      object,
      hand,
      parent,
      localPosition,
      localQuaternion,
      durationSeconds: 0.45,
    },
    ctx,
  )
}
