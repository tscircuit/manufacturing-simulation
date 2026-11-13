import { getOccupants, releaseSlot, reserveSlot } from "lib/job/container-slots"
import type { JobStage, JobStep, UnitParams } from "lib/job/job-step"
import { OUTBOUND_SPOT, STATIONS } from "lib/layout/station-layout"
import { CARTON_LABEL } from "lib/models/carton-label"
import { SHIPPING_CARTON } from "lib/models/shipping-carton"
import { WHITE_MAILER_BOX } from "lib/models/white-mailer-box"
import type { OperatorHand } from "lib/operator/create-operator"
import type { SimContext } from "lib/simulation/sim-context"
import { playCue } from "lib/simulation/sound-cues"
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
  moveObject,
  reachHand,
  releaseHand,
  trackObjectPoint,
  walkTo,
  walkToStation,
} from "lib/tasks/operator-motions"
import {
  IDENTITY_QUATERNION,
  SHIP_READY_BENCH_SPOTS,
} from "lib/world/bench-spots"
import { type Group, Quaternion, Vector3 } from "three"

export const SHIP_CLOSE_UP = {
  azimuthRadians: 1.2,
  elevationRadians: 0.85,
  distanceM: 1.1,
}

const LABEL_FEED_SECONDS = 1.4
const LABEL_GRIP_POINT = new Vector3(0, 0, CARTON_LABEL.lengthM * 0.38)
const LABEL_PRINTER_CLOSE_UP = {
  azimuthRadians: -0.65,
  elevationRadians: 0.78,
  distanceM: 0.6,
}
const FRONT_LABEL_POSITION = new Vector3(
  -0.055,
  SHIPPING_CARTON.innerHeightM * 0.71,
  SHIPPING_CARTON.innerWidthM / 2 + SHIPPING_CARTON.boardThicknessM + 0.0005,
)
const FRONT_LABEL_QUATERNION = new Quaternion().setFromAxisAngle(
  new Vector3(1, 0, 0),
  Math.PI / 2,
)

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
  ctx.statusText = `Loading box ${slotIndex + 1} into the Amazon carton`
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

function* printAndApplyCartonLabel(ctx: SimContext): SimTask {
  const { carton, cartonLabel, cartonLabelPrinter, tables } = ctx.world
  const label = cartonLabel.group
  const printer = cartonLabelPrinter.group
  const hand = ctx.operator.rightHand
  const bench = tables.ship_ready_bench

  ctx.statusText = "Moving to the Ship-ready label printer"
  yield* walkToStation(STATIONS.cartonLabelPrinter, ctx)
  ctx.cameraHint = {
    station: STATIONS.cartonLabelPrinter,
    view: LABEL_PRINTER_CLOSE_UP,
    getFocusPoint: trackObjectPoint({
      object: printer,
      localPoint: cartonLabelPrinter.feedEnd,
    }),
  }
  yield* waitSeconds(0.35)
  ctx.statusText = "Printing the FBA Box ID label"
  label.visible = true
  playCue("thermal_label_printer", ctx)
  yield* tween({
    durationSeconds: LABEL_FEED_SECONDS,
    onProgress: (progress) => {
      label.position.lerpVectors(
        cartonLabelPrinter.feedStart,
        cartonLabelPrinter.feedEnd,
        progress,
      )
    },
  })

  ctx.statusText =
    "Setting the printed FBA Box ID label on the Ship-ready table"
  ctx.cameraHint = {
    station: STATIONS.cartonLabelPrinter,
    view: LABEL_PRINTER_CLOSE_UP,
    getFocusPoint: trackObjectPoint({
      object: bench,
      localPoint: SHIP_READY_BENCH_SPOTS.cartonLabelRest,
    }),
  }
  yield* grabObject({ hand, object: label, localGripPoint: LABEL_GRIP_POINT })
  yield* moveObject(
    {
      object: label,
      hand,
      parent: bench,
      localPosition: SHIP_READY_BENCH_SPOTS.cartonLabelRest,
      localQuaternion: IDENTITY_QUATERNION,
      arcHeightM: 0.06,
    },
    ctx,
  )
  yield* releaseHand(hand)
  yield* waitSeconds(0.35)

  ctx.statusText = "Applying the FBA Box ID label to the sealed carton"
  ctx.cameraHint = {
    station: STATIONS.shipReady,
    view: { azimuthRadians: 0.52, elevationRadians: 0.42, distanceM: 0.85 },
    getFocusPoint: trackObjectPoint({
      object: carton.group,
      localPoint: FRONT_LABEL_POSITION,
    }),
  }
  yield* grabObject({ hand, object: label, localGripPoint: LABEL_GRIP_POINT })
  yield* moveObject(
    {
      object: label,
      hand,
      parent: carton.group,
      localPosition: FRONT_LABEL_POSITION,
      localQuaternion: FRONT_LABEL_QUATERNION,
      durationSeconds: 1,
      arcHeightM: 0.05,
    },
    ctx,
  )
  yield* waitSeconds(0.65)
  yield* releaseHand(hand)
}

/** Fold, tape and label the carton before carrying it to the outbound spot. */
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
  playCue("flap_fold", ctx)
  yield* runInParallel([
    foldFlap({ flap: carton.backFlap, axis: "x", hand: leftHand }),
    foldFlap({ flap: carton.frontFlap, axis: "x", hand: rightHand }),
  ])
  yield* runInParallel([releaseHand(leftHand), releaseHand(rightHand)])

  ctx.statusText = "Taping the seam"
  const tapeEnd = new Vector3()
  // The tape gun rides on the leading end of the tape.
  yield* reachHand({
    hand: rightHand,
    getTarget: () => {
      carton.tape.updateWorldMatrix(true, false)
      return carton.tape.localToWorld(tapeEnd.set(carton.tapeLengthM, 0.02, 0))
    },
    durationSeconds: 0.5,
  })
  // Start the strip down the left end face, then pull it across the seam.
  carton.tape.visible = true
  carton.tapeEndTabs[0].visible = true
  playCue("tape_gun", ctx)
  yield* tween({
    durationSeconds: 1.4,
    onProgress: (progress) => {
      carton.tape.scale.x = Math.max(0.001, progress)
    },
  })
  // Fold it down the right end face and cut.
  carton.tapeEndTabs[1].visible = true
  yield* releaseHand(rightHand)
  yield* waitSeconds(0.2)

  yield* printAndApplyCartonLabel(ctx)
  yield* walkToStation(STATIONS.shipReady, ctx)

  ctx.statusText = "Carrying the labeled carton to the door to ship"
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
  for (const unitIndex of getOccupants(carton))
    world.units[unitIndex].stage = "shipped"
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
