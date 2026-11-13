import { getScrewdriverFocusPoint } from "lib/job/bench-frames"
import { STATIONS } from "lib/layout/station-layout"
import { SCREWDRIVER_GRIP_OFFSET_M } from "lib/models/screwdriver"
import type { SimContext } from "lib/simulation/sim-context"
import type { SimTask } from "lib/tasks/coroutines"
import {
  grabObject,
  holdInHand,
  moveObject,
  releaseHand,
} from "lib/tasks/operator-motions"
import {
  ASSEMBLY_BENCH_SPOTS,
  SCREWDRIVER_REST_QUATERNION,
} from "lib/world/bench-spots"
import { Euler, Quaternion, Vector3 } from "three"

/** Right hand closes around the screwdriver grip. */
export function* takeScrewdriver(ctx: SimContext): SimTask {
  yield* grabObject({
    hand: ctx.operator.rightHand,
    object: ctx.world.screwdriver.group,
    localGripPoint: new Vector3(0, SCREWDRIVER_GRIP_OFFSET_M, 0),
    fingerCurl: 0.95,
    durationSeconds: 0.7,
  })
}

/** Lay the screwdriver back in its spot and open the right hand. */
export function* returnScrewdriver(ctx: SimContext): SimTask {
  yield* moveObject(
    {
      object: ctx.world.screwdriver.group,
      hand: ctx.operator.rightHand,
      parent: ctx.world.tables.assembly_bench,
      localPosition: ASSEMBLY_BENCH_SPOTS.screwdriverRest,
      localQuaternion: SCREWDRIVER_REST_QUATERNION,
      durationSeconds: 0.8,
      arcHeightM: 0.05,
    },
    ctx,
  )
  yield* releaseHand(ctx.operator.rightHand)
}

/** Left hand braces the motor body while the right hand drives screws. */
export function* steadyMotor(
  params: { unitIndex: number },
  ctx: SimContext,
): SimTask {
  yield* grabObject({
    hand: ctx.operator.leftHand,
    object: ctx.world.units[params.unitIndex].motor.group,
    localGripPoint: new Vector3(-0.0215, 0.018, 0.006),
    fingerCurl: 0.55,
    durationSeconds: 0.6,
  })
}

/** Pick the screwdriver up off the bench and hold it at the chest, outside the job. */
export function* pickUpLooseScrewdriver(ctx: SimContext): SimTask {
  const { operator, progress, world } = ctx
  progress.isOperatorBusy = true
  ctx.statusText = "Picking up the screwdriver"
  ctx.cameraHint = {
    station: STATIONS.assembly,
    view: { azimuthRadians: 2.5, elevationRadians: 0.5, distanceM: 1.0 },
    getFocusPoint: () => getScrewdriverFocusPoint(ctx),
  }
  yield* takeScrewdriver(ctx)
  operator.group.updateWorldMatrix(true, false)
  const holdQuaternion = operator.group
    .getWorldQuaternion(new Quaternion())
    .multiply(new Quaternion().setFromEuler(new Euler(-0.35, 0, 0)))
  const gripPosition = operator.group.localToWorld(
    new Vector3(-0.17, 1.12, 0.34),
  )
  const tipPosition = gripPosition.sub(
    new Vector3(0, SCREWDRIVER_GRIP_OFFSET_M, 0).applyQuaternion(
      holdQuaternion,
    ),
  )
  yield* moveObject(
    {
      object: world.screwdriver.group,
      hand: operator.rightHand,
      parent: ctx.world.root,
      localPosition: tipPosition,
      localQuaternion: holdQuaternion,
      durationSeconds: 0.9,
      arcHeightM: 0.03,
    },
    ctx,
  )
  holdInHand({ hand: operator.rightHand, object: world.screwdriver.group })
  progress.isHoldingLooseScrewdriver = true
  progress.isOperatorBusy = false
  ctx.cameraHint = null
  ctx.statusText = "Holding the screwdriver"
}

export function* putBackLooseScrewdriver(ctx: SimContext): SimTask {
  ctx.progress.isOperatorBusy = true
  ctx.statusText = "Putting the screwdriver back"
  yield* returnScrewdriver(ctx)
  ctx.progress.isHoldingLooseScrewdriver = false
  ctx.progress.isOperatorBusy = false
  ctx.statusText = "Screwdriver is back on the bench"
}
