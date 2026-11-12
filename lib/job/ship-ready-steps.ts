import { type Group, Vector3 } from "three"
import { BATCH_SIZE, OUTBOUND_SPOT, STATIONS } from "lib/layout/station-layout"
import type { JobStage, UnitParams } from "lib/job/job-step"
import { SHIPPING_CARTON_CAPACITY } from "lib/models/shipping-carton"
import { WHITE_MAILER_BOX } from "lib/models/white-mailer-box"
import type { OperatorHand } from "lib/operator/create-operator"
import type { SimContext } from "lib/simulation/sim-context"
import {
  runInParallel,
  type SimTask,
  tween,
  waitSeconds,
} from "lib/tasks/coroutines"
import {
  grabObject,
  holdInHand,
  liftAndPlace,
  moveObject,
  reachHand,
  releaseHand,
  trackObjectPoint,
  walkTo,
} from "lib/tasks/operator-motions"
import { IDENTITY_QUATERNION } from "lib/world/bench-spots"

const SHIP_CLOSE_UP = {
  azimuthRadians: 1.2,
  elevationRadians: 0.85,
  distanceM: 1.1,
}

function getCartonFocusPoint(ctx: SimContext): Vector3 {
  ctx.world.carton.group.updateWorldMatrix(true, false)
  return ctx.world.carton.group.localToWorld(new Vector3(0, 0.3, 0))
}

function* loadBoxIntoCarton(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { box } = world.units[params.unitIndex]
  const hand = operator.rightHand
  ctx.statusText = `Box ${params.unitIndex + 1} of ${BATCH_SIZE} into the Amazon carton (holds ${SHIPPING_CARTON_CAPACITY})`
  yield* grabObject({
    hand,
    object: box.group,
    localGripPoint: new Vector3(0, WHITE_MAILER_BOX.heightM, 0),
    fingerCurl: 0.6,
    durationSeconds: 0.6,
  })
  yield* liftAndPlace(
    {
      object: box.group,
      hand,
      parent: world.carton.group,
      localPosition: world.carton.slots[params.unitIndex].position,
      localQuaternion: IDENTITY_QUATERNION,
      liftHeightM: 0.12,
      travelSeconds: 0.8,
    },
    ctx,
  )
  yield* releaseHand(hand)
}

function* foldFlap(params: {
  flap: Group
  axis: "x" | "z"
  hand: OperatorHand
}): SimTask {
  const { flap, axis, hand } = params
  yield* reachHand({
    hand,
    getTarget: trackObjectPoint({
      object: flap,
      localPoint: new Vector3(0, 0, 0),
    }),
    durationSeconds: 0.5,
  })
  const start = flap.rotation[axis]
  yield* tween({
    durationSeconds: 0.7,
    onProgress: (progress) => {
      flap.rotation[axis] = start * (1 - progress)
    },
  })
}

function* sealAndShip(_params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { carton } = world
  const { leftHand, rightHand } = operator
  ctx.statusText = "Folding the carton flaps"
  yield* runInParallel([
    foldFlap({ flap: carton.leftFlap, axis: "z", hand: leftHand }),
    foldFlap({ flap: carton.rightFlap, axis: "z", hand: rightHand }),
  ])
  yield* runInParallel([
    foldFlap({ flap: carton.backFlap, axis: "x", hand: leftHand }),
    foldFlap({ flap: carton.frontFlap, axis: "x", hand: rightHand }),
  ])
  yield* runInParallel([releaseHand(leftHand), releaseHand(rightHand)])

  ctx.statusText = "Taping the seam"
  carton.tape.visible = true
  const tapeEnd = new Vector3()
  yield* reachHand({
    hand: rightHand,
    getTarget: () => {
      carton.tape.updateWorldMatrix(true, false)
      return carton.tape.localToWorld(
        tapeEnd.set(carton.tape.scale.x * 0.5, 0.01, 0),
      )
    },
    durationSeconds: 0.5,
  })
  yield* tween({
    durationSeconds: 1.4,
    onProgress: (progress) => {
      carton.tape.scale.x = Math.max(0.001, progress)
    },
  })
  yield* releaseHand(rightHand)
  yield* waitSeconds(0.2)

  ctx.statusText = "Setting the sealed carton out by the door to ship"
  yield* runInParallel([
    grabObject({
      hand: leftHand,
      object: carton.leftGrip,
      fingerCurl: 0.7,
      durationSeconds: 0.7,
    }),
    grabObject({
      hand: rightHand,
      object: carton.rightGrip,
      fingerCurl: 0.7,
      durationSeconds: 0.7,
    }),
  ])
  yield* moveObject(
    {
      object: carton.group,
      hand: rightHand,
      parent: world.tables.ship_ready_bench,
      localPosition: carton.group.position
        .clone()
        .add(new Vector3(0, 0.05, 0.3)),
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 1,
    },
    ctx,
  )
  holdInHand({ hand: rightHand, object: carton.group })
  yield* walkTo(
    {
      x: OUTBOUND_SPOT.xM - 0.55,
      z: OUTBOUND_SPOT.zM,
      finalCcwYawRadians: Math.PI / 2,
    },
    ctx,
  )
  yield* moveObject(
    {
      object: carton.group,
      hand: rightHand,
      parent: ctx.world.root,
      localPosition: new Vector3(OUTBOUND_SPOT.xM, 0, OUTBOUND_SPOT.zM),
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 1.2,
    },
    ctx,
  )
  yield* runInParallel([releaseHand(leftHand), releaseHand(rightHand)])
}

export const LOAD_CARTON_STAGE: JobStage = {
  label: "Ship-ready",
  isPerUnit: true,
  steps: [
    {
      label: "Load box into the Amazon carton",
      station: STATIONS.shipReady,
      closeUpView: SHIP_CLOSE_UP,
      getFocusPoint: (_params, ctx) => getCartonFocusPoint(ctx),
      run: loadBoxIntoCarton,
    },
  ],
}

export const SEAL_AND_SHIP_STAGE: JobStage = {
  label: "Seal and ship",
  isPerUnit: false,
  steps: [
    {
      label: "Seal the carton, set it out to ship",
      station: STATIONS.shipReady,
      closeUpView: { ...SHIP_CLOSE_UP, distanceM: 1.5 },
      getFocusPoint: (_params, ctx) => getCartonFocusPoint(ctx),
      run: sealAndShip,
    },
  ],
}
