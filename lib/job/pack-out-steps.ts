import { type Group, Quaternion, Vector3 } from "three"
import { FOLDING_TABLE, STATIONS } from "lib/layout/station-layout"
import {
  getLabelFocusPoint,
  getPackingFocusPoint,
  getShipReadyFocusPoint,
} from "lib/job/bench-frames"
import type { JobStep } from "lib/job/job-step"
import { COILED_USB_CABLE } from "lib/models/coiled-usb-cable"
import { NEMA17 } from "lib/models/nema17-motor"
import { STICKER } from "lib/models/sticker"
import {
  BOX_POCKETS,
  POCKET_FLOOR_YM,
  WHITE_MAILER_BOX,
} from "lib/models/white-mailer-box"
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
  walkToStation,
} from "lib/tasks/operator-motions"
import {
  IDENTITY_QUATERNION,
  MOTOR_IN_BOX_QUATERNION,
  PACK_OUT_BENCH_SPOTS,
  SHIP_READY_BENCH_SPOTS,
} from "lib/world/bench-spots"

/** From beside the operator, so the open lid and the operator don't hide the foam. */
const PACK_CLOSE_UP = {
  azimuthRadians: 1.2,
  elevationRadians: 0.95,
  distanceM: 0.6,
}
/** Mount face sits 15 mm toward the shaft end of the pocket centre, so the PCB and cable fit. */
const MOTOR_IN_BOX_POSITION = new Vector3(
  BOX_POCKETS.motor.x - 0.015,
  POCKET_FLOOR_YM + NEMA17.faceSizeM / 2,
  BOX_POCKETS.motor.z,
)
const LABEL_PEEL_QUATERNION = new Quaternion().setFromAxisAngle(
  new Vector3(1, 0, 0),
  -0.45,
)

function* openOrCloseLid(
  params: { hand: OperatorHand; isOpening: boolean },
  ctx: SimContext,
): SimTask {
  const { box } = ctx.world
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
      parent: ctx.world.box.group,
      localPosition: params.pocketPosition,
      localQuaternion: IDENTITY_QUATERNION,
      liftHeightM: 0.06,
      travelSeconds: 0.7,
    },
    ctx,
  )
  yield* releaseHand(params.hand)
}

function* openBoxAndNestMotor(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { box } = world
  ctx.statusText = "Taking a 7×4×3 white mailer off the stack"
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
      liftHeightM: 0.04,
    },
    ctx,
  )
  yield* releaseHand(operator.leftHand)

  ctx.statusText = "Opening the lid: pink anti-static foam top and bottom"
  yield* openOrCloseLid({ hand: operator.leftHand, isOpening: true }, ctx)

  ctx.statusText = "Nesting the motor and its cable in the foam"
  yield* moveObject(
    {
      object: world.motor.group,
      hand: operator.rightHand,
      parent: box.group,
      localPosition: MOTOR_IN_BOX_POSITION,
      localQuaternion: MOTOR_IN_BOX_QUATERNION,
      durationSeconds: 1.1,
      arcHeightM: 0.06,
    },
    ctx,
  )
  yield* releaseHand(operator.rightHand)
}

function* addCablesAndCharger(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const coilGrip = new Vector3(0.017, 0.008, 0)
  const { usbCables, charger } = BOX_POCKETS
  for (const [index, coil] of world.packedUsbCables.entries()) {
    ctx.statusText = `Adding USB-C cable ${index + 1} of 2`
    yield* placeInPocket(
      {
        item: coil,
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
  ctx.statusText = "Adding the 45 W USB-C charger"
  yield* placeInPocket(
    {
      item: world.packedCharger,
      hand: operator.rightHand,
      gripPoint: new Vector3(0, 0.024, 0.016),
      pocketPosition: new Vector3(charger.x, POCKET_FLOOR_YM, charger.z),
    },
    ctx,
  )
}

function* closeBoxAndApplyLabel(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { box, sticker } = world
  const hand = operator.rightHand
  ctx.statusText = "Closing the lid and tucking the front"
  yield* openOrCloseLid({ hand: operator.leftHand, isOpening: false }, ctx)

  ctx.statusText = "Peeling a 2×4 label off the AveneMark sheet"
  const sheet = sticker.parent
  if (!sheet) throw new Error("Label must start on its sheet")
  yield* grabObject({
    hand,
    object: sticker,
    localGripPoint: new Vector3(0, 0.001, STICKER.lengthM / 2 - 0.01),
    fingerCurl: 1,
    durationSeconds: 0.7,
  })
  yield* moveObject(
    {
      object: sticker,
      hand,
      parent: sheet,
      localPosition: sticker.position.clone().add(new Vector3(0, 0.04, 0.03)),
      localQuaternion: sticker.quaternion
        .clone()
        .multiply(LABEL_PEEL_QUATERNION),
      durationSeconds: 0.6,
    },
    ctx,
  )

  ctx.statusText = "Sticking the label on the lid"
  yield* moveObject(
    {
      object: sticker,
      hand,
      parent: box.lid,
      localPosition: box.stickerSpot.position
        .clone()
        .add(new Vector3(0, 0.012, 0)),
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 1,
      arcHeightM: 0.06,
    },
    ctx,
  )
  yield* moveObject(
    {
      object: sticker,
      hand,
      parent: box.lid,
      localPosition: box.stickerSpot.position,
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 0.35,
    },
    ctx,
  )
  // Smooth it down from the back edge to the front edge.
  const halfLabelM = STICKER.lengthM / 2 - 0.008
  yield* reachHand({
    hand,
    getTarget: trackObjectPoint({
      object: sticker,
      localPoint: new Vector3(0, 0, -halfLabelM),
    }),
    durationSeconds: 0.3,
  })
  yield* reachHand({
    hand,
    getTarget: trackObjectPoint({
      object: sticker,
      localPoint: new Vector3(0, 0, halfLabelM),
    }),
    durationSeconds: 0.6,
    arcHeightM: 0,
  })
  yield* releaseHand(hand)
}

function* moveBoxToShipReady(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { box } = world
  const { leftHand, rightHand } = operator
  const halfLengthM = WHITE_MAILER_BOX.lengthM / 2
  ctx.statusText = "Carrying the packed box to ship-ready"
  yield* runInParallel([
    grabObject({
      hand: leftHand,
      object: box.group,
      localGripPoint: new Vector3(-halfLengthM, 0.045, 0.02),
      fingerCurl: 0.5,
      durationSeconds: 0.6,
    }),
    grabObject({
      hand: rightHand,
      object: box.group,
      localGripPoint: new Vector3(halfLengthM, 0.045, 0.02),
      fingerCurl: 0.5,
      durationSeconds: 0.6,
    }),
  ])
  yield* moveObject(
    {
      object: box.group,
      hand: rightHand,
      parent: world.tables.pack_out_bench,
      localPosition: new Vector3(
        PACK_OUT_BENCH_SPOTS.packing.x,
        FOLDING_TABLE.topHeightM + 0.22,
        0.36,
      ),
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 0.7,
    },
    ctx,
  )
  holdInHand({ hand: rightHand, object: box.group })
  yield* walkToStation(STATIONS.shipReady, ctx)
  yield* moveObject(
    {
      object: box.group,
      hand: rightHand,
      parent: world.tables.ship_ready_bench,
      localPosition: SHIP_READY_BENCH_SPOTS.outgoing,
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 0.9,
      arcHeightM: 0.03,
    },
    ctx,
  )
  yield* runInParallel([releaseHand(leftHand), releaseHand(rightHand)])
  yield* waitSeconds(0.2)
}

export const PACK_OUT_STEPS: JobStep[] = [
  {
    label: "Open a box, nest the motor",
    station: STATIONS.packOut,
    closeUpView: PACK_CLOSE_UP,
    getFocusPoint: getPackingFocusPoint,
    run: openBoxAndNestMotor,
  },
  {
    label: "Add 2 USB-C cables and charger",
    station: STATIONS.packOut,
    closeUpView: PACK_CLOSE_UP,
    getFocusPoint: getPackingFocusPoint,
    run: addCablesAndCharger,
  },
  {
    label: "Close the box, apply the label",
    station: STATIONS.packOut,
    closeUpView: {
      ...PACK_CLOSE_UP,
      azimuthRadians: 1.45,
      elevationRadians: 1.05,
      distanceM: 0.95,
    },
    getFocusPoint: getLabelFocusPoint,
    run: closeBoxAndApplyLabel,
  },
  {
    label: "Move box to ship-ready",
    station: STATIONS.packOut,
    closeUpView: { ...PACK_CLOSE_UP, distanceM: 1.4 },
    getFocusPoint: getShipReadyFocusPoint,
    run: moveBoxToShipReady,
  },
]
