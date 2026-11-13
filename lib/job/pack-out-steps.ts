import { getLabelFocusPoint, getPackingFocusPoint } from "lib/job/bench-frames"
import { releaseSlot, reserveSlot } from "lib/job/container-slots"
import type { JobStage, UnitParams } from "lib/job/job-step"
import { countLabelsAtPackOut, takeNextLabel } from "lib/job/label-stock"
import { MOTOR_IN_BOX_POSITION } from "lib/job/unit-poses"
import { STATIONS } from "lib/layout/station-layout"
import { COILED_USB_CABLE } from "lib/models/coiled-usb-cable"
import { STICKER } from "lib/models/sticker"
import {
  BOX_POCKETS,
  POCKET_FLOOR_YM,
  WHITE_MAILER_BOX,
  type WhiteMailerBox,
} from "lib/models/white-mailer-box"
import type { OperatorHand } from "lib/operator/create-operator"
import type { SimContext } from "lib/simulation/sim-context"
import { type SimTask, tween } from "lib/tasks/coroutines"
import {
  grabObject,
  liftAndPlace,
  moveObject,
  reachHand,
  releaseHand,
  trackObjectPoint,
} from "lib/tasks/operator-motions"
import {
  IDENTITY_QUATERNION,
  MOTOR_IN_BOX_QUATERNION,
  PACK_OUT_BENCH_SPOTS,
} from "lib/world/bench-spots"
import { type Group, Quaternion, Vector3 } from "three"

/** From beside the operator, so the open lid and the operator don't hide the foam. */
const PACK_CLOSE_UP = {
  azimuthRadians: 1.2,
  elevationRadians: 0.95,
  distanceM: 0.65,
}
const LABEL_PEEL_QUATERNION = new Quaternion().setFromAxisAngle(
  new Vector3(1, 0, 0),
  -0.45,
)
const TOTE_LIFT_M = 0.34

function* openOrCloseLid(params: {
  box: WhiteMailerBox
  hand: OperatorHand
  isOpening: boolean
}): SimTask {
  const { box } = params
  yield* reachHand({
    hand: params.hand,
    getTarget: trackObjectPoint({ object: box.lidTip }),
    durationSeconds: 0.6,
  })
  const { lidOpenRadians } = WHITE_MAILER_BOX
  yield* tween({
    durationSeconds: 1.1,
    onProgress: (progress) => {
      box.lid.rotation.x =
        lidOpenRadians * (params.isOpening ? progress : 1 - progress)
    },
  })
  yield* releaseHand(params.hand)
}

function* placeInPocket(
  params: {
    item: Group
    box: WhiteMailerBox
    hand: OperatorHand
    gripPoint: Vector3
    pocketPosition: Vector3
  },
  ctx: SimContext,
): SimTask {
  yield* grabObject({
    hand: params.hand,
    object: params.item,
    localGripPoint: params.gripPoint,
    fingerCurl: 0.8,
    durationSeconds: 0.7,
  })
  yield* liftAndPlace(
    {
      object: params.item,
      hand: params.hand,
      parent: params.box.group,
      localPosition: params.pocketPosition,
      localQuaternion: IDENTITY_QUATERNION,
      liftHeightM: 0.06,
      travelSeconds: 0.7,
    },
    ctx,
  )
  yield* releaseHand(params.hand)
}

function* openBoxAndNestMotor(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const { box } = unit
  releaseSlot({ container: world.readyRack, unitIndex: params.unitIndex })
  ctx.statusText = `Unit ${params.unitIndex + 1}: taking a white mailer off the stack`
  yield* grabObject({
    hand: operator.leftHand,
    object: box.group,
    localGripPoint: new Vector3(
      0,
      WHITE_MAILER_BOX.heightM * 0.6,
      WHITE_MAILER_BOX.widthM / 2,
    ),
    fingerCurl: 0.6,
    durationSeconds: 0.8,
  })
  yield* liftAndPlace(
    {
      object: box.group,
      hand: operator.leftHand,
      parent: world.tables.pack_out_bench,
      localPosition: PACK_OUT_BENCH_SPOTS.packing,
      localQuaternion: IDENTITY_QUATERNION,
      liftHeightM: 0.05,
    },
    ctx,
  )
  yield* releaseHand(operator.leftHand)

  ctx.statusText = `Unit ${params.unitIndex + 1}: opening the lid, pink anti-static foam top and bottom`
  yield* openOrCloseLid({ box, hand: operator.leftHand, isOpening: true })

  ctx.statusText = `Unit ${params.unitIndex + 1}: nesting the motor and its cable in the foam`
  yield* grabObject({
    hand: operator.rightHand,
    object: unit.motor.group,
    localGripPoint: new Vector3(0, 0.03, 0.021),
    fingerCurl: 0.6,
    durationSeconds: 0.7,
  })
  yield* moveObject(
    {
      object: unit.motor.group,
      hand: operator.rightHand,
      parent: box.group,
      localPosition: MOTOR_IN_BOX_POSITION,
      localQuaternion: MOTOR_IN_BOX_QUATERNION,
      durationSeconds: 1.2,
      arcHeightM: 0.09,
    },
    ctx,
  )
  yield* releaseHand(operator.rightHand)
}

function* addCablesAndCharger(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const coilGrip = new Vector3(0.017, 0.008, 0)
  const { usbCables, charger } = BOX_POCKETS
  for (const [index, coil] of unit.usbCables.entries()) {
    ctx.statusText = `Unit ${params.unitIndex + 1}: adding USB-C cable ${index + 1} of 2`
    yield* placeInPocket(
      {
        item: coil,
        box: unit.box,
        hand: operator.rightHand,
        gripPoint: coilGrip,
        pocketPosition: new Vector3(
          usbCables.x,
          POCKET_FLOOR_YM + index * COILED_USB_CABLE.heightM,
          usbCables.z,
        ),
      },
      ctx,
    )
  }
  ctx.statusText = `Unit ${params.unitIndex + 1}: adding the 45 W USB-C charger`
  yield* placeInPocket(
    {
      item: unit.charger,
      box: unit.box,
      hand: operator.rightHand,
      gripPoint: new Vector3(0, 0.024, 0.016),
      pocketPosition: new Vector3(charger.x, POCKET_FLOOR_YM, charger.z),
    },
    ctx,
  )
}

function* closeBoxAndApplyLabel(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const { box } = unit
  const hand = operator.rightHand
  ctx.statusText = `Unit ${params.unitIndex + 1}: closing the lid and tucking the front`
  yield* openOrCloseLid({ box, hand: operator.leftHand, isOpening: false })

  const label = takeNextLabel(world)
  if (!label) throw new Error("No labels left at pack-out")
  unit.label = label

  ctx.statusText = `Unit ${params.unitIndex + 1}: peeling a 2×4 label off the sheet`
  const sheet = label.parent
  if (!sheet) throw new Error("Label must start on its sheet")
  yield* grabObject({
    hand,
    object: label,
    localGripPoint: new Vector3(0, 0.001, STICKER.lengthM / 2 - 0.01),
    fingerCurl: 1,
    durationSeconds: 0.7,
  })
  yield* moveObject(
    {
      object: label,
      hand,
      parent: sheet,
      localPosition: label.position.clone().add(new Vector3(0, 0.04, 0.03)),
      localQuaternion: label.quaternion.clone().multiply(LABEL_PEEL_QUATERNION),
      durationSeconds: 0.5,
    },
    ctx,
  )
  ctx.statusText = `Unit ${params.unitIndex + 1}: sticking the label on the lid`
  yield* moveObject(
    {
      object: label,
      hand,
      parent: box.lid,
      localPosition: box.stickerSpot.position
        .clone()
        .add(new Vector3(0, 0.012, 0)),
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 0.9,
      arcHeightM: 0.06,
    },
    ctx,
  )
  yield* moveObject(
    {
      object: label,
      hand,
      parent: box.lid,
      localPosition: box.stickerSpot.position,
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 0.3,
    },
    ctx,
  )
  const halfLabelM = STICKER.lengthM / 2 - 0.008
  yield* reachHand({
    hand,
    getTarget: trackObjectPoint({
      object: label,
      localPoint: new Vector3(0, 0, -halfLabelM),
    }),
    durationSeconds: 0.3,
  })
  yield* reachHand({
    hand,
    getTarget: trackObjectPoint({
      object: label,
      localPoint: new Vector3(0, 0, halfLabelM),
    }),
    durationSeconds: 0.5,
    arcHeightM: 0,
  })
  yield* releaseHand(hand)
}

function* boxIntoTote(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { box } = world.units[params.unitIndex]
  const hand = operator.leftHand
  const slotIndex = reserveSlot({
    container: world.packingTote,
    unitIndex: params.unitIndex,
  })
  ctx.statusText = `Unit ${params.unitIndex + 1}: packed box into the tote`
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
      parent: world.packingTote.group,
      localPosition: world.packingTote.slots[slotIndex].position,
      localQuaternion: IDENTITY_QUATERNION,
      liftHeightM: TOTE_LIFT_M,
      travelSeconds: 0.8,
    },
    ctx,
  )
  yield* releaseHand(hand)
}

export const PACK_OUT_STAGE: JobStage = {
  label: "Pack-out",
  isPerUnit: true,
  steps: [
    {
      label: "Open a box, nest the motor",
      station: STATIONS.packOut,
      closeUpView: PACK_CLOSE_UP,
      getFocusPoint: (_params, ctx) => getPackingFocusPoint(ctx),
      run: openBoxAndNestMotor,
    },
    {
      label: "Add 2 USB-C cables and charger",
      station: STATIONS.packOut,
      closeUpView: PACK_CLOSE_UP,
      getFocusPoint: (_params, ctx) => getPackingFocusPoint(ctx),
      run: addCablesAndCharger,
    },
    {
      label: "Close the box, apply the label",
      station: STATIONS.packOutLabels,
      closeUpView: {
        ...PACK_CLOSE_UP,
        azimuthRadians: 1.3,
        elevationRadians: 0.72,
        distanceM: 1.1,
      },
      getFocusPoint: (_params, ctx) => getLabelFocusPoint(ctx),
      run: closeBoxAndApplyLabel,
      getBlocker: (_params, ctx) =>
        countLabelsAtPackOut(ctx.world) > 0
          ? null
          : "No labels left at pack-out. Collect printed sheets from the label printer.",
    },
    {
      label: "Packed box into the tote",
      station: STATIONS.packOutLabels,
      closeUpView: {
        ...PACK_CLOSE_UP,
        azimuthRadians: 1.3,
        elevationRadians: 0.72,
        distanceM: 1.1,
      },
      getFocusPoint: (_params, ctx) => getLabelFocusPoint(ctx),
      run: boxIntoTote,
    },
  ],
}
