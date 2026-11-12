import { Vector3 } from "three"
import { STATIONS } from "lib/layout/station-layout"
import { getSpacerBasketFocusPoint } from "lib/job/bench-frames"
import type { JobStep } from "lib/job/job-step"
import { FORWARD_FINGER_DIRECTION } from "lib/operator/operator-body"
import type { SimContext } from "lib/simulation/sim-context"
import type { SimTask } from "lib/tasks/coroutines"
import {
  bringHandToCarryPose,
  grabObject,
  holdInHand,
  moveObject,
} from "lib/tasks/operator-motions"

function* pickSpacerFromBasket(ctx: SimContext): SimTask {
  const { spacer } = ctx.world
  const hand = ctx.operator.rightHand
  const basket = spacer.parent
  if (!basket) throw new Error("Spacer must start in the basket")
  ctx.statusText = "Picking a printed spacer out of the basket"
  hand.targetFingerDirection.copy(FORWARD_FINGER_DIRECTION)
  yield* grabObject({
    hand,
    object: spacer,
    localGripPoint: new Vector3(0, 0.003, 0.019),
    fingerCurl: 1,
    durationSeconds: 0.9,
  })
  yield* moveObject(
    {
      object: spacer,
      hand,
      parent: basket,
      localPosition: spacer.position.clone().add(new Vector3(0, 0.08, 0.03)),
      localQuaternion: spacer.quaternion.clone(),
      durationSeconds: 0.5,
    },
    ctx,
  )
  holdInHand({ hand, object: spacer })
  yield* bringHandToCarryPose(hand, ctx)
}

export const SPACER_BENCH_STEPS: JobStep[] = [
  {
    label: "Pick a spacer from the basket",
    station: STATIONS.spacers,
    closeUpView: { azimuthRadians: 2.5, elevationRadians: 0.6, distanceM: 0.9 },
    getFocusPoint: getSpacerBasketFocusPoint,
    run: pickSpacerFromBasket,
  },
]
