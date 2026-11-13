import type { Station } from "lib/layout/station-layout"
import type { SimContext } from "lib/simulation/sim-context"
import { runInParallel, type SimTask } from "lib/tasks/coroutines"
import {
  grabObject,
  moveObject,
  releaseHand,
  walkToStation,
} from "lib/tasks/operator-motions"
import { IDENTITY_QUATERNION } from "lib/world/bench-spots"
import { type Group, type Object3D, Vector3 } from "three"

/** Where the middle of the two handles sits while carrying, in the operator's frame (facing +Z). */
const CARRY_HANDLE_MIDPOINT = new Vector3(0, 1.0, 0.36)

/**
 * Lift an item by two grips and hold it in front of the body. The item is
 * fixed to the operator while carried, and each hand stays on its grip, so it
 * moves steadily with the body when walking.
 */
export function* pickUpInFront(
  params: { item: Group; leftGrip: Object3D; rightGrip: Object3D },
  ctx: SimContext,
): SimTask {
  const { item, leftGrip, rightGrip } = params
  const { operator } = ctx
  yield* runInParallel([
    grabObject({
      hand: operator.leftHand,
      object: leftGrip,
      fingerCurl: 0.85,
      durationSeconds: 0.7,
    }),
    grabObject({
      hand: operator.rightHand,
      object: rightGrip,
      fingerCurl: 0.85,
      durationSeconds: 0.7,
    }),
  ])
  item.updateWorldMatrix(true, false)
  const gripMidpoint = leftGrip
    .getWorldPosition(new Vector3())
    .add(rightGrip.getWorldPosition(new Vector3()))
    .multiplyScalar(0.5)
  const midpointInItem = item.worldToLocal(gripMidpoint)
  yield* moveObject(
    {
      object: item,
      hand: operator.rightHand,
      parent: operator.group,
      localPosition: CARRY_HANDLE_MIDPOINT.clone().sub(midpointInItem),
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 0.9,
      arcHeightM: 0.03,
    },
    ctx,
  )
  item.userData.isCarried = true
}

/** Set a carried item down at a pose in `toParent` and let go with both hands. */
export function* setDownFromCarry(
  params: { item: Group; toParent: Object3D; toPosition: Vector3 },
  ctx: SimContext,
): SimTask {
  const { operator } = ctx
  yield* moveObject(
    {
      object: params.item,
      hand: operator.rightHand,
      parent: params.toParent,
      localPosition: params.toPosition,
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 1,
      arcHeightM: 0.03,
    },
    ctx,
  )
  yield* runInParallel([
    releaseHand(operator.leftHand),
    releaseHand(operator.rightHand),
  ])
}

/** Pick up a rack, tote or tub by its two grips, carry it to another bench and set it down there. */
export function* carryWithBothHands(
  params: {
    item: Group
    leftHandle: Object3D
    rightHandle: Object3D
    toStation: Station
    toParent: Object3D
    toPosition: Vector3
  },
  ctx: SimContext,
): SimTask {
  yield* pickUpInFront(
    {
      item: params.item,
      leftGrip: params.leftHandle,
      rightGrip: params.rightHandle,
    },
    ctx,
  )
  yield* walkToStation(params.toStation, ctx)
  yield* setDownFromCarry(
    {
      item: params.item,
      toParent: params.toParent,
      toPosition: params.toPosition,
    },
    ctx,
  )
}
