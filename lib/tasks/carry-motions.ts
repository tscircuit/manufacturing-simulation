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
import { type Group, type Object3D, Quaternion, Vector3 } from "three"

const UP = new Vector3(0, 1, 0)

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
  const { item } = params
  const { operator } = ctx
  // Each hand takes the grip on its own side, whichever way round the item sits on the bench.
  operator.group.updateWorldMatrix(true, false)
  const isSwapped =
    operator.group.worldToLocal(params.leftGrip.getWorldPosition(new Vector3()))
      .x <
    operator.group.worldToLocal(
      params.rightGrip.getWorldPosition(new Vector3()),
    ).x
  const leftGrip = isSwapped ? params.rightGrip : params.leftGrip
  const rightGrip = isSwapped ? params.leftGrip : params.rightGrip
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
  const leftInItem = item.worldToLocal(leftGrip.getWorldPosition(new Vector3()))
  const rightInItem = item.worldToLocal(
    rightGrip.getWorldPosition(new Vector3()),
  )
  // Turn the item so the left grip is on the operator's left (+X) and the right grip on the right: hands never cross.
  const acrossYawRadians = Math.atan2(
    leftInItem.z - rightInItem.z,
    leftInItem.x - rightInItem.x,
  )
  const carryQuaternion = new Quaternion().setFromAxisAngle(
    UP,
    acrossYawRadians,
  )
  const midpointInItem = leftInItem.add(rightInItem).multiplyScalar(0.5)
  // Upright with the load held close: no bending at the hips while carrying.
  operator.isCarryingLoad = true
  yield* moveObject(
    {
      object: item,
      hand: operator.rightHand,
      parent: operator.group,
      localPosition: CARRY_HANDLE_MIDPOINT.clone().sub(
        midpointInItem.applyQuaternion(carryQuaternion),
      ),
      localQuaternion: carryQuaternion,
      durationSeconds: 0.9,
      arcHeightM: 0.03,
    },
    ctx,
  )
  operator.isCarryingLoad = true
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
