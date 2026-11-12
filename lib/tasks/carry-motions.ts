import { type Group, type Object3D, Vector3 } from "three"
import type { Station } from "lib/layout/station-layout"
import type { SimContext } from "lib/simulation/sim-context"
import { runInParallel, type SimTask } from "lib/tasks/coroutines"
import {
  grabObject,
  holdInHand,
  moveObject,
  releaseHand,
  walkToStation,
} from "lib/tasks/operator-motions"
import { IDENTITY_QUATERNION } from "lib/world/bench-spots"

/**
 * Pick up a rack or tote by its two handles, carry it to another bench and set
 * it down there. The right hand holds it while walking; the left hand stays on
 * its handle.
 */
export function* carryWithBothHands(
  params: {
    item: Group
    leftHandle: Object3D
    rightHandle: Object3D
    liftHeightM: number
    toStation: Station
    toParent: Object3D
    toPosition: Vector3
  },
  ctx: SimContext,
): SimTask {
  const { item } = params
  const { leftHand, rightHand } = ctx.operator
  yield* runInParallel([
    grabObject({
      hand: leftHand,
      object: params.leftHandle,
      fingerCurl: 0.85,
      durationSeconds: 0.7,
    }),
    grabObject({
      hand: rightHand,
      object: params.rightHandle,
      fingerCurl: 0.85,
      durationSeconds: 0.7,
    }),
  ])
  const startParent = item.parent
  if (!startParent) throw new Error("Item to carry must be on a bench")
  yield* moveObject(
    {
      object: item,
      hand: rightHand,
      parent: startParent,
      localPosition: item.position
        .clone()
        .add(new Vector3(0, params.liftHeightM, 0.12)),
      localQuaternion: item.quaternion.clone(),
      durationSeconds: 0.8,
    },
    ctx,
  )
  holdInHand({ hand: rightHand, object: item })
  yield* walkToStation(params.toStation, ctx)
  yield* moveObject(
    {
      object: item,
      hand: rightHand,
      parent: params.toParent,
      localPosition: params.toPosition,
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 1,
      arcHeightM: 0.03,
    },
    ctx,
  )
  yield* runInParallel([releaseHand(leftHand), releaseHand(rightHand)])
}
