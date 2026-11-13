import { getOccupants, releaseSlot, reserveSlot } from "lib/job/container-slots"
import type { JobStage, JobStep, UnitParams } from "lib/job/job-step"
import { OUTBOUND_SPOT, STATIONS } from "lib/layout/station-layout"
import { SHIPPING_CARTON_CAPACITY } from "lib/models/shipping-carton"
import { WHITE_MAILER_BOX } from "lib/models/white-mailer-box"
import type { OperatorHand } from "lib/operator/create-operator"
import type { SimContext } from "lib/simulation/sim-context"
import { pickUpInFront, setDownFromCarry } from "lib/tasks/carry-motions"
import {
  runInParallel,
  type SimTask,
  tween,
  waitSeconds,
} from "lib/tasks/coroutines"
import {
  grabObject,
  liftAndPlace,
  reachHand,
  releaseHand,
  trackObjectPoint,
  walkTo,
} from "lib/tasks/operator-motions"
import { IDENTITY_QUATERNION } from "lib/world/bench-spots"
import { type Group, Vector3 } from "three"

export const SHIP_CLOSE_UP = {
  azimuthRadians: 1.2,
  elevationRadians: 0.85,
  distanceM: 1.1,
}

export function getCartonFocusPoint(ctx: SimContext): Vector3 {
  ctx.world.carton.group.updateWorldMatrix(true, false)
  return ctx.world.carton.group.localToWorld(new Vector3(0, 0.3, 0))
}

function* loadBoxIntoCarton(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { box } = world.units[params.unitIndex]
  const hand = operator.rightHand
  releaseSlot({ container: world.packingTote, unitIndex: params.unitIndex })
  const slotIndex = reserveSlot({
    container: world.carton,
    unitIndex: params.unitIndex,
  })
  ctx.statusText = `Box ${slotIndex + 1} of ${SHIPPING_CARTON_CAPACITY} into the Amazon carton`
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
      localPosition: world.carton.slots[slotIndex].position,
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
    getTarget: trackObjectPoint({ object: flap }),
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

/** Fold and tape the carton, then carry it to the outbound spot by the door. */
export function* sealAndShip(_params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { carton } = world
  const { leftHand, rightHand } = operator
  const boxCount = getOccupants(carton).length
  ctx.statusText = `Folding the carton flaps over ${boxCount} boxes`
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

  ctx.statusText = "Carrying the sealed carton to the door to ship"
  for (const unitIndex of getOccupants(carton))
    world.units[unitIndex].stage = "shipped"
  yield* pickUpInFront(
    {
      item: carton.group,
      leftGrip: carton.leftGrip,
      rightGrip: carton.rightGrip,
    },
    ctx,
  )
  yield* walkTo(
    {
      x: OUTBOUND_SPOT.xM - 0.55,
      z: OUTBOUND_SPOT.zM,
      finalCcwYawRadians: Math.PI / 2,
    },
    ctx,
  )
  yield* setDownFromCarry(
    {
      item: carton.group,
      toParent: world.root,
      toPosition: new Vector3(OUTBOUND_SPOT.xM, 0, OUTBOUND_SPOT.zM),
    },
    ctx,
  )
  world.isCartonShipped = true
}

const LOAD_CARTON_STEPS: JobStep[] = [
  {
    label: "Load box into the Amazon carton",
    station: STATIONS.shipReady,
    closeUpView: SHIP_CLOSE_UP,
    getFocusPoint: (_params, ctx) => getCartonFocusPoint(ctx),
    run: loadBoxIntoCarton,
  },
]

export const LOAD_CARTON_STAGE: JobStage = {
  label: "Ship-ready",
  isPerUnit: true,
  steps: LOAD_CARTON_STEPS,
}
