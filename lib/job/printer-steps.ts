import { Euler, Quaternion, Vector3 } from "three"
import { STATIONS } from "lib/layout/station-layout"
import type { JobStep } from "lib/job/job-step"
import { FORWARD_FINGER_DIRECTION } from "lib/operator/operator-body"
import type { SimContext } from "lib/simulation/sim-context"
import { type SimTask, tween, waitSeconds } from "lib/tasks/coroutines"
import {
  bringHandToCarryPose,
  grabObject,
  holdInHand,
  moveObject,
  releaseHand,
} from "lib/tasks/operator-motions"

const DOOR_OPEN_CCW_YAW_RADIANS = -1.75

function* swingPrinterDoor(
  params: { isOpening: boolean },
  ctx: SimContext,
): SimTask {
  const { door, doorHandle } = ctx.world.printer
  const hand = ctx.operator.leftHand
  yield* grabObject({
    hand,
    object: doorHandle,
    fingerCurl: 0.8,
    durationSeconds: 0.75,
  })
  yield* tween({
    durationSeconds: 1.05,
    onProgress: (progress) => {
      const openFraction = params.isOpening ? progress : 1 - progress
      door.rotation.y = DOOR_OPEN_CCW_YAW_RADIANS * openFraction
    },
  })
  yield* releaseHand(hand)
}

function* takeSpacerFromPrinter(ctx: SimContext): SimTask {
  const { printer, spacer } = ctx.world
  const hand = ctx.operator.rightHand
  ctx.statusText = "Opening the printer door"
  yield* swingPrinterDoor({ isOpening: true }, ctx)

  ctx.statusText = "Lifting the NEMA17 back spacer off the build plate"
  hand.targetFingerDirection.copy(FORWARD_FINGER_DIRECTION)
  yield* grabObject({
    hand,
    object: spacer,
    localGripPoint: new Vector3(0, 0.004, 0.019),
    fingerCurl: 1,
    durationSeconds: 1,
  })
  yield* waitSeconds(0.25)
  // Peel the print off the textured plate by tipping it up.
  yield* moveObject(
    {
      object: spacer,
      hand,
      parent: printer.group,
      localPosition: new Vector3(
        spacer.position.x,
        spacer.position.y + 0.016,
        spacer.position.z + 0.01,
      ),
      localQuaternion: new Quaternion().setFromEuler(new Euler(0.25, 0, 0)),
      durationSeconds: 0.35,
    },
    ctx,
  )
  holdInHand({ hand, object: spacer })
  yield* bringHandToCarryPose(hand, ctx)

  ctx.statusText = "Closing the printer door"
  yield* swingPrinterDoor({ isOpening: false }, ctx)
}

export const PRINTER_STEPS: JobStep[] = [
  {
    label: "Take spacer print out of the P2S",
    station: STATIONS.printer,
    closeUpView: {
      azimuthRadians: -0.85,
      elevationRadians: 0.42,
      distanceM: 1.25,
    },
    getFocusPoint: (ctx) =>
      ctx.world.printer.buildPlate.getWorldPosition(new Vector3()),
    run: takeSpacerFromPrinter,
  },
]
