import { Vector3 } from "three"
import { STATIONS } from "lib/layout/station-layout"
import {
  getJigFocusPoint,
  getPointInTableFrame,
  getSpacerBasketFocusPoint,
} from "lib/job/bench-frames"
import { FORWARD_FINGER_DIRECTION } from "lib/operator/operator-body"
import type { JobStep } from "lib/job/job-step"
import {
  returnScrewdriver,
  steadyMotor,
  takeScrewdriver,
} from "lib/job/screwdriver-motions"
import { BACKFACE_SPACER } from "lib/models/backface-spacer"
import { CONTROLLER_PCB } from "lib/models/controller-pcb"
import {
  LONG_SCREW_SHANK_M,
  NEMA17,
  STOCK_SCREW_SHANK_M,
} from "lib/models/nema17-motor"
import type { SimContext } from "lib/simulation/sim-context"
import {
  runInParallel,
  type SimTask,
  tween,
  waitSeconds,
} from "lib/tasks/coroutines"
import {
  bringHandToCarryPose,
  grabObject,
  holdInHand,
  liftAndPlace,
  moveObject,
  releaseHand,
} from "lib/tasks/operator-motions"
import { plugIn } from "lib/tasks/plug-motions"
import {
  ASSEMBLY_BENCH_SPOTS,
  IDENTITY_QUATERNION,
  SCREW_LYING_QUATERNION,
} from "lib/world/bench-spots"

const SCREW_TURN_RADIANS = 15
const SCREW_DRIVE_SECONDS = 1.4
/** Spacer (4 mm) plus PCB sit on the back face; screws seat on top of the PCB. */
const PCB_TOP_ABOVE_MOUNT_FACE_M =
  NEMA17.backfaceHeightM +
  BACKFACE_SPACER.baseHeightM +
  BACKFACE_SPACER.sleeveHeightM +
  CONTROLLER_PCB.thicknessM
/** Tool tip height above a bin's floor when dropping or picking a screw. */
const BIN_WORK_HEIGHT_M = 0.035

const ASSEMBLY_CLOSE_UP = {
  azimuthRadians: 2.5,
  elevationRadians: 0.6,
  distanceM: 0.55,
}

function* moveScrewdriverTo(
  params: {
    localPosition: Vector3
    durationSeconds: number
    arcHeightM: number
  },
  ctx: SimContext,
): SimTask {
  yield* moveObject(
    {
      object: ctx.world.screwdriver.group,
      hand: ctx.operator.rightHand,
      parent: ctx.world.tables.assembly_bench,
      localPosition: params.localPosition,
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: params.durationSeconds,
      arcHeightM: params.arcHeightM,
    },
    ctx,
  )
}

function* takeSpacerFromBasket(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { spacer } = world
  const hand = operator.rightHand
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
      localPosition: spacer.position.clone().add(new Vector3(0, 0.07, 0.03)),
      localQuaternion: spacer.quaternion.clone(),
      durationSeconds: 0.45,
    },
    ctx,
  )
  ctx.statusText = "Setting the spacer down by the jig"
  yield* moveObject(
    {
      object: spacer,
      hand,
      parent: world.tables.assembly_bench,
      localPosition: ASSEMBLY_BENCH_SPOTS.spacerRest,
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 0.9,
      arcHeightM: 0.05,
    },
    ctx,
  )
  yield* releaseHand(hand)
}

function* loadMotorIntoJig(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  ctx.statusText = "Loading a NEMA17 into the jig, back face up"
  yield* grabObject({
    hand: operator.leftHand,
    object: world.motor.group,
    localGripPoint: new Vector3(0, 0.034, 0.02),
    fingerCurl: 0.6,
    durationSeconds: 0.8,
  })
  yield* liftAndPlace(
    {
      object: world.motor.group,
      hand: operator.leftHand,
      parent: world.tables.assembly_bench,
      localPosition: ASSEMBLY_BENCH_SPOTS.jigTop,
      localQuaternion: IDENTITY_QUATERNION,
      liftHeightM: 0.04,
    },
    ctx,
  )
  yield* releaseHand(operator.leftHand)
}

function* removeStockScrews(ctx: SimContext): SimTask {
  const { world } = ctx
  const { screwdriver, motor, usedScrewBin } = world
  ctx.statusText = "Picking up the screwdriver"
  yield* runInParallel([steadyMotor(ctx), takeScrewdriver(ctx)])

  for (const [index, stockScrew] of motor.stockScrews.entries()) {
    const screw = stockScrew.group
    ctx.statusText = `Removing stock screw ${index + 1} of 4`
    yield* moveScrewdriverTo(
      {
        localPosition: getPointInTableFrame(
          {
            tableId: "assembly_bench",
            object: screw,
            localPoint: new Vector3(0, 0.003, 0),
          },
          ctx,
        ),
        durationSeconds: index === 0 ? 0.9 : 0.5,
        arcHeightM: 0.035,
      },
      ctx,
    )
    const screwStartYM = screw.position.y
    const toolStartYM = screwdriver.group.position.y
    yield* tween({
      durationSeconds: SCREW_DRIVE_SECONDS,
      onProgress: (progress) => {
        screw.position.y = screwStartYM + STOCK_SCREW_SHANK_M * progress
        screw.rotation.y = SCREW_TURN_RADIANS * progress
        screwdriver.spinningPart.rotation.y = SCREW_TURN_RADIANS * progress
        screwdriver.group.position.y =
          toolStartYM + STOCK_SCREW_SHANK_M * progress
      },
    })

    ctx.statusText = `Dropping stock screw ${index + 1} in the used-screw bin`
    screwdriver.group.attach(screw)
    const dropPoint = usedScrewBin.position
      .clone()
      .add(new Vector3((index - 1.5) * 0.018, BIN_WORK_HEIGHT_M, 0.01))
    yield* moveScrewdriverTo(
      { localPosition: dropPoint, durationSeconds: 0.55, arcHeightM: 0.04 },
      ctx,
    )
    usedScrewBin.attach(screw)
    const fallStartPosition = screw.position.clone()
    const fallStartQuaternion = screw.quaternion.clone()
    const restPosition = new Vector3(
      (index - 1.5) * 0.018,
      0.0025 + 0.00275,
      0.01 + (index % 2) * 0.012,
    )
    yield* tween({
      durationSeconds: 0.25,
      onProgress: (progress) => {
        screw.position.lerpVectors(fallStartPosition, restPosition, progress)
        screw.quaternion
          .copy(fallStartQuaternion)
          .slerp(SCREW_LYING_QUATERNION, progress)
      },
    })
    world.removedStockScrews.push(screw)
  }
  ctx.statusText = "Setting the screwdriver down"
  yield* returnScrewdriver(ctx)
  yield* releaseHand(ctx.operator.leftHand)
}

function* fitSpacer(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  ctx.statusText = "Seating the 4 mm spacer over the screw holes"
  yield* grabObject({
    hand: operator.rightHand,
    object: world.spacer,
    localGripPoint: new Vector3(0, 0.003, 0.019),
    fingerCurl: 1,
    durationSeconds: 0.7,
  })
  yield* moveObject(
    {
      object: world.spacer,
      hand: operator.rightHand,
      parent: world.motor.group,
      localPosition: new Vector3(0, NEMA17.backfaceHeightM, 0),
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 1,
      arcHeightM: 0.07,
    },
    ctx,
  )
  yield* waitSeconds(0.3)
  yield* releaseHand(operator.rightHand)
}

function* fitControllerPcb(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  ctx.statusText = "Placing the motor controller PCB on the spacer sleeves"
  yield* grabObject({
    hand: operator.leftHand,
    object: world.pcb.group,
    localGripPoint: new Vector3(0, 0.002, 0.02),
    fingerCurl: 1,
    durationSeconds: 0.8,
  })
  yield* moveObject(
    {
      object: world.pcb.group,
      hand: operator.leftHand,
      parent: world.motor.group,
      localPosition: new Vector3(
        0,
        PCB_TOP_ABOVE_MOUNT_FACE_M - CONTROLLER_PCB.thicknessM,
        0,
      ),
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 1.1,
      arcHeightM: 0.07,
    },
    ctx,
  )
  yield* waitSeconds(0.3)
  yield* releaseHand(operator.leftHand)
}

function* driveLongScrews(ctx: SimContext): SimTask {
  const { world } = ctx
  const { screwdriver, motor, longScrews } = world
  const halfPitchM = NEMA17.screwPitchM / 2
  ctx.statusText = "Picking up the screwdriver"
  yield* runInParallel([steadyMotor(ctx), takeScrewdriver(ctx)])

  for (const [index, screw] of longScrews.entries()) {
    const { corner } = motor.stockScrews[index]
    ctx.statusText = `Taking long screw ${index + 1} of 4 from the bin`
    yield* moveScrewdriverTo(
      {
        localPosition: getPointInTableFrame(
          {
            tableId: "assembly_bench",
            object: screw,
            localPoint: new Vector3(0, 0.004, 0),
          },
          ctx,
        ),
        durationSeconds: index === 0 ? 0.9 : 0.6,
        arcHeightM: 0.04,
      },
      ctx,
    )
    // The magnetic bit picks the screw up and stands it upright.
    screwdriver.group.attach(screw)
    const pickupStartPosition = screw.position.clone()
    const pickupStartQuaternion = screw.quaternion.clone()
    const onBitPosition = new Vector3(0, -0.003, 0)
    yield* tween({
      durationSeconds: 0.18,
      onProgress: (progress) => {
        screw.position.lerpVectors(pickupStartPosition, onBitPosition, progress)
        screw.quaternion
          .copy(pickupStartQuaternion)
          .slerp(IDENTITY_QUATERNION, progress)
      },
    })

    ctx.statusText = `Driving long screw ${index + 1} of 4 through the PCB and spacer`
    const holeX = corner.xSign * halfPitchM
    const holeZ = corner.zSign * halfPitchM
    const screwStartYM = PCB_TOP_ABOVE_MOUNT_FACE_M + LONG_SCREW_SHANK_M
    yield* moveScrewdriverTo(
      {
        localPosition: getPointInTableFrame(
          {
            tableId: "assembly_bench",
            object: motor.group,
            localPoint: new Vector3(holeX, screwStartYM + 0.003, holeZ),
          },
          ctx,
        ),
        durationSeconds: 0.7,
        arcHeightM: 0.04,
      },
      ctx,
    )
    motor.group.attach(screw)
    screw.position.set(holeX, screwStartYM, holeZ)
    screw.quaternion.identity()
    const toolStartYM = screwdriver.group.position.y
    yield* tween({
      durationSeconds: SCREW_DRIVE_SECONDS,
      onProgress: (progress) => {
        screw.position.y = screwStartYM - LONG_SCREW_SHANK_M * progress
        screw.rotation.y = -SCREW_TURN_RADIANS * progress
        screwdriver.spinningPart.rotation.y = -SCREW_TURN_RADIANS * progress
        screwdriver.group.position.y =
          toolStartYM - LONG_SCREW_SHANK_M * progress
      },
    })
  }
  ctx.statusText = "Setting the screwdriver down"
  yield* returnScrewdriver(ctx)
  yield* releaseHand(ctx.operator.leftHand)
}

function* plugInMotorCable(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { motorCable, motor, pcb } = world
  const bench = world.tables.assembly_bench
  const { jigTop } = ASSEMBLY_BENCH_SPOTS
  const plugGrip = new Vector3(0, 0.005, 0)
  ctx.statusText = "Taking a pre-crimped cable out of the cable bin"
  yield* runInParallel([
    grabObject({
      hand: operator.rightHand,
      object: motorCable.motorPlug.group,
      localGripPoint: plugGrip,
      fingerCurl: 0.95,
    }),
    grabObject({
      hand: operator.leftHand,
      object: motorCable.boardPlug.group,
      localGripPoint: plugGrip,
      fingerCurl: 0.95,
    }),
  ])
  // Lift the whole cable out with both hands and bring it over the jig.
  motorCable.cable.slackFrame = bench
  motorCable.cable.slackOffset.set(0, -0.02, 0.02)
  yield* runInParallel([
    moveObject(
      {
        object: motorCable.motorPlug.group,
        hand: operator.rightHand,
        parent: bench,
        localPosition: new Vector3(
          jigTop.x + 0.02,
          jigTop.y + 0.09,
          jigTop.z - 0.02,
        ),
        localQuaternion: motor.cableSocket.quaternion,
        durationSeconds: 1,
        arcHeightM: 0.05,
      },
      ctx,
    ),
    moveObject(
      {
        object: motorCable.boardPlug.group,
        hand: operator.leftHand,
        parent: bench,
        localPosition: new Vector3(jigTop.x - 0.04, jigTop.y + 0.1, jigTop.z),
        localQuaternion: IDENTITY_QUATERNION,
        durationSeconds: 1,
        arcHeightM: 0.05,
      },
      ctx,
    ),
  ])
  ctx.statusText = "Plugging the cable into the side of the motor"
  yield* plugIn(
    {
      plug: motorCable.motorPlug,
      hand: operator.rightHand,
      port: motor.cableSocket,
    },
    ctx,
  )
  ctx.statusText = "Plugging the other end into the PCB motor header"
  yield* plugIn(
    {
      plug: motorCable.boardPlug,
      hand: operator.leftHand,
      port: pcb.motorHeader,
    },
    ctx,
  )
  // From now on the cable loops back along the motor body wherever it goes.
  motorCable.cable.slackFrame = motor.group
  motorCable.cable.slackOffset.set(0, 0.014, 0)
}

function* pickUpMotorAssembly(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { jigTop } = ASSEMBLY_BENCH_SPOTS
  ctx.statusText = "Lifting the finished motor assembly out of the jig"
  yield* grabObject({
    hand: operator.rightHand,
    object: world.motor.group,
    localGripPoint: new Vector3(0, 0.03, 0.021),
    fingerCurl: 0.6,
    durationSeconds: 0.7,
  })
  yield* moveObject(
    {
      object: world.motor.group,
      hand: operator.rightHand,
      parent: world.tables.assembly_bench,
      localPosition: new Vector3(jigTop.x, jigTop.y + 0.05, jigTop.z),
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 0.5,
    },
    ctx,
  )
  holdInHand({ hand: operator.rightHand, object: world.motor.group })
  yield* bringHandToCarryPose(operator.rightHand, ctx)
}

export const ASSEMBLY_BENCH_STEPS: JobStep[] = [
  {
    label: "Take a spacer from the basket",
    station: STATIONS.spacers,
    closeUpView: { ...ASSEMBLY_CLOSE_UP, distanceM: 0.9 },
    getFocusPoint: getSpacerBasketFocusPoint,
    run: takeSpacerFromBasket,
  },
  {
    label: "Load a motor in the jig",
    station: STATIONS.assembly,
    closeUpView: { ...ASSEMBLY_CLOSE_UP, distanceM: 0.95 },
    getFocusPoint: getJigFocusPoint,
    run: loadMotorIntoJig,
  },
  {
    label: "Remove 4 stock screws to the used bin",
    station: STATIONS.assembly,
    closeUpView: { ...ASSEMBLY_CLOSE_UP, distanceM: 0.65 },
    getFocusPoint: getJigFocusPoint,
    run: removeStockScrews,
  },
  {
    label: "Fit spacer on the back face",
    station: STATIONS.assembly,
    closeUpView: ASSEMBLY_CLOSE_UP,
    getFocusPoint: getJigFocusPoint,
    run: fitSpacer,
  },
  {
    label: "Fit controller PCB",
    station: STATIONS.assembly,
    closeUpView: ASSEMBLY_CLOSE_UP,
    getFocusPoint: getJigFocusPoint,
    run: fitControllerPcb,
  },
  {
    label: "Drive 4 long screws from the bin",
    station: STATIONS.assembly,
    closeUpView: { ...ASSEMBLY_CLOSE_UP, distanceM: 0.65 },
    getFocusPoint: getJigFocusPoint,
    run: driveLongScrews,
  },
  {
    label: "Plug in the motor cable",
    station: STATIONS.assembly,
    closeUpView: {
      azimuthRadians: 2.0,
      elevationRadians: 0.4,
      distanceM: 0.45,
    },
    getFocusPoint: getJigFocusPoint,
    run: plugInMotorCable,
  },
  {
    label: "Pick up the motor assembly",
    station: STATIONS.assembly,
    closeUpView: { ...ASSEMBLY_CLOSE_UP, distanceM: 0.8 },
    getFocusPoint: getJigFocusPoint,
    run: pickUpMotorAssembly,
  },
]
