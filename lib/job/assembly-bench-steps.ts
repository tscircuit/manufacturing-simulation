import { getJigFocusPoint, getPointInTableFrame } from "lib/job/bench-frames"
import { releaseSlot, reserveSlot } from "lib/job/container-slots"
import type { JobStage, JobStep, UnitParams } from "lib/job/job-step"
import {
  returnScrewdriver,
  steadyMotor,
  takeScrewdriver,
} from "lib/job/screwdriver-motions"
import { PCB_TOP_ABOVE_MOUNT_FACE_M } from "lib/job/unit-poses"
import { STATIONS } from "lib/layout/station-layout"
import { CONTROLLER_PCB } from "lib/models/controller-pcb"
import {
  LONG_SCREW_SHANK_M,
  NEMA17,
  STOCK_SCREW_SHANK_M,
} from "lib/models/nema17-motor"
import { FORWARD_FINGER_DIRECTION } from "lib/operator/operator-body"
import type { SimContext } from "lib/simulation/sim-context"
import { playCue } from "lib/simulation/sound-cues"
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
  releaseHand,
} from "lib/tasks/operator-motions"
import { plugIn } from "lib/tasks/plug-motions"
import {
  ASSEMBLY_BENCH_SPOTS,
  IDENTITY_QUATERNION,
  SCREW_LYING_QUATERNION,
} from "lib/world/bench-spots"
import {
  scatter,
  setOutLongScrews,
  setOutMotorCable,
} from "lib/world/create-world"
import { Vector3 } from "three"

/** Bit rotation for one screw, removing or driving; the sound reads it to judge load. */
export const SCREW_TURN_RADIANS = 15
const SCREW_DRIVE_SECONDS = 1.4
/** From the operator's side, clear of the window mullions; the operator fades if he's in the way. */
const ASSEMBLY_CLOSE_UP = {
  azimuthRadians: 0.9,
  elevationRadians: 0.85,
  distanceM: 0.6,
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

function* loadMotorIntoJig(params: UnitParams, ctx: SimContext): SimTask {
  const { motor } = ctx.world.units[params.unitIndex]
  releaseSlot({
    container: ctx.world.motorFoamStand,
    unitIndex: params.unitIndex,
  })
  const hand = ctx.operator.leftHand
  ctx.statusText = `Unit ${params.unitIndex + 1}: loading a NEMA17 from the foam stand into the jig`
  yield* grabObject({
    hand,
    object: motor.group,
    localGripPoint: new Vector3(0, 0.034, 0.02),
    fingerCurl: 0.6,
    durationSeconds: 0.8,
  })
  yield* liftAndPlace(
    {
      object: motor.group,
      hand,
      parent: ctx.world.tables.assembly_bench,
      localPosition: ASSEMBLY_BENCH_SPOTS.jigTop,
      localQuaternion: IDENTITY_QUATERNION,
      liftHeightM: 0.05,
    },
    ctx,
  )
  yield* releaseHand(hand)
}

function* removeStockScrews(params: UnitParams, ctx: SimContext): SimTask {
  const { world } = ctx
  const { screwdriver, usedScrewBin } = world
  const { motor } = world.units[params.unitIndex]
  ctx.statusText = "Picking up the screwdriver"
  yield* runInParallel([steadyMotor(params, ctx), takeScrewdriver(ctx)])

  for (const [index, stockScrew] of motor.stockScrews.entries()) {
    const screw = stockScrew.group
    ctx.statusText = `Unit ${params.unitIndex + 1}: removing stock screw ${index + 1} of 4`
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

    ctx.statusText = `Unit ${params.unitIndex + 1}: dropping stock screw ${index + 1} in the used-screw bin`
    screwdriver.group.attach(screw)
    const removedIndex = world.removedStockScrews.length
    const restPosition = new Vector3(
      (scatter(removedIndex + 900) - 0.5) * 0.07,
      0.0025 + 0.00275 + Math.floor(removedIndex / 16) * 0.004,
      (scatter(removedIndex + 950) - 0.5) * 0.09,
    )
    yield* moveScrewdriverTo(
      {
        localPosition: usedScrewBin.position
          .clone()
          .add(new Vector3(restPosition.x, 0.035, restPosition.z)),
        durationSeconds: 0.55,
        arcHeightM: 0.04,
      },
      ctx,
    )
    usedScrewBin.attach(screw)
    const fallStartPosition = screw.position.clone()
    const fallStartQuaternion = screw.quaternion.clone()
    const restQuaternion = SCREW_LYING_QUATERNION.clone().premultiply(
      IDENTITY_QUATERNION.clone().setFromAxisAngle(
        new Vector3(0, 1, 0),
        scatter(removedIndex + 990) * Math.PI * 2,
      ),
    )
    yield* tween({
      durationSeconds: 0.25,
      onProgress: (progress) => {
        screw.position.lerpVectors(fallStartPosition, restPosition, progress)
        screw.quaternion
          .copy(fallStartQuaternion)
          .slerp(restQuaternion, progress)
      },
    })
    playCue("screw_drop", ctx)
    world.removedStockScrews.push(screw)
  }
  ctx.statusText = "Setting the screwdriver down"
  yield* returnScrewdriver(ctx)
  yield* releaseHand(ctx.operator.leftHand)
}

function* fitSpacerFromBasket(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const spacer = world.spacerStock.pop()
  if (!spacer) throw new Error("The spacer basket is empty")
  unit.spacer = spacer
  const hand = operator.rightHand
  ctx.statusText = `Unit ${params.unitIndex + 1}: taking a spacer from the basket`
  hand.targetFingerDirection.copy(FORWARD_FINGER_DIRECTION)
  yield* grabObject({
    hand,
    object: spacer,
    localGripPoint: new Vector3(0, 0.003, 0.019),
    fingerCurl: 1,
    durationSeconds: 0.7,
  })
  ctx.statusText = `Unit ${params.unitIndex + 1}: seating the 4 mm spacer over the screw holes`
  yield* moveObject(
    {
      object: spacer,
      hand,
      parent: unit.motor.group,
      localPosition: new Vector3(0, NEMA17.backfaceHeightM, 0),
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 1,
      arcHeightM: 0.08,
    },
    ctx,
  )
  yield* waitSeconds(0.25)
  yield* releaseHand(hand)
}

function* fitControllerPcb(params: UnitParams, ctx: SimContext): SimTask {
  const unit = ctx.world.units[params.unitIndex]
  const hand = ctx.operator.leftHand
  ctx.statusText = `Unit ${params.unitIndex + 1}: placing the controller PCB on the spacer sleeves`
  yield* grabObject({
    hand,
    object: unit.pcb.group,
    localGripPoint: new Vector3(0, 0.002, 0.02),
    fingerCurl: 1,
    durationSeconds: 0.8,
  })
  yield* moveObject(
    {
      object: unit.pcb.group,
      hand,
      parent: unit.motor.group,
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
  yield* waitSeconds(0.25)
  yield* releaseHand(hand)
}

function* driveLongScrews(params: UnitParams, ctx: SimContext): SimTask {
  const { world } = ctx
  const { screwdriver } = world
  const unit = world.units[params.unitIndex]
  const { motor } = unit
  unit.longScrews = setOutLongScrews({
    bin: world.longScrewBin,
    unitIndex: params.unitIndex,
  })
  const halfPitchM = NEMA17.screwPitchM / 2
  ctx.statusText = "Picking up the screwdriver"
  yield* runInParallel([steadyMotor(params, ctx), takeScrewdriver(ctx)])

  for (const [index, screw] of unit.longScrews.entries()) {
    const { corner } = motor.stockScrews[index]
    ctx.statusText = `Unit ${params.unitIndex + 1}: taking long screw ${index + 1} of 4 from the bin`
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

    ctx.statusText = `Unit ${params.unitIndex + 1}: driving long screw ${index + 1} of 4 through the PCB and spacer`
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

function* plugInMotorCable(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const { motor, pcb } = unit
  const motorCable = setOutMotorCable({ world })
  unit.motorCable = motorCable
  const bench = world.tables.assembly_bench
  const { jigTop } = ASSEMBLY_BENCH_SPOTS
  const plugGrip = new Vector3(0, 0.005, 0)
  ctx.statusText = `Unit ${params.unitIndex + 1}: taking a pre-crimped cable out of the cable bin`
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
  ctx.statusText = `Unit ${params.unitIndex + 1}: plugging the cable into the side of the motor`
  yield* plugIn(
    {
      plug: motorCable.motorPlug,
      hand: operator.rightHand,
      port: motor.cableSocket,
    },
    ctx,
  )
  ctx.statusText = `Unit ${params.unitIndex + 1}: plugging the other end into the PCB motor header`
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

function* rackFinishedAssembly(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { motor } = world.units[params.unitIndex]
  const hand = operator.rightHand
  const slotIndex = reserveSlot({
    container: world.finishedRack,
    unitIndex: params.unitIndex,
  })
  ctx.statusText = `Unit ${params.unitIndex + 1}: setting the finished assembly in the rack`
  yield* grabObject({
    hand,
    object: motor.group,
    localGripPoint: new Vector3(0, 0.03, 0.021),
    fingerCurl: 0.6,
    durationSeconds: 0.6,
  })
  yield* liftAndPlace(
    {
      object: motor.group,
      hand,
      parent: world.finishedRack.group,
      localPosition: world.finishedRack.slots[slotIndex].position,
      localQuaternion: IDENTITY_QUATERNION,
      liftHeightM: 0.06,
      travelSeconds: 0.9,
    },
    ctx,
  )
  yield* releaseHand(hand)
}

const ASSEMBLY_STEPS: JobStep[] = [
  {
    label: "Load a motor in the jig",
    station: STATIONS.assembly,
    closeUpView: { ...ASSEMBLY_CLOSE_UP, distanceM: 0.95 },
    getFocusPoint: (_params, ctx) => getJigFocusPoint(ctx),
    run: loadMotorIntoJig,
  },
  {
    label: "Remove 4 stock screws to the used bin",
    station: STATIONS.assembly,
    closeUpView: { ...ASSEMBLY_CLOSE_UP, distanceM: 0.65 },
    getFocusPoint: (_params, ctx) => getJigFocusPoint(ctx),
    run: removeStockScrews,
  },
  {
    label: "Fit a spacer from the basket",
    station: STATIONS.assembly,
    closeUpView: { ...ASSEMBLY_CLOSE_UP, distanceM: 0.65 },
    getFocusPoint: (_params, ctx) => getJigFocusPoint(ctx),
    run: fitSpacerFromBasket,
    getBlocker: (_params, ctx) =>
      ctx.world.spacerStock.length > 0
        ? null
        : "The spacer basket is empty. Collect prints from the 3D printers and refill it.",
  },
  {
    label: "Fit controller PCB",
    station: STATIONS.assembly,
    closeUpView: ASSEMBLY_CLOSE_UP,
    getFocusPoint: (_params, ctx) => getJigFocusPoint(ctx),
    run: fitControllerPcb,
  },
  {
    label: "Drive 4 long screws from the bin",
    station: STATIONS.assembly,
    closeUpView: { ...ASSEMBLY_CLOSE_UP, distanceM: 0.65 },
    getFocusPoint: (_params, ctx) => getJigFocusPoint(ctx),
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
    getFocusPoint: (_params, ctx) => getJigFocusPoint(ctx),
    run: plugInMotorCable,
  },
  {
    label: "Rack the finished assembly",
    station: STATIONS.assembly,
    closeUpView: { ...ASSEMBLY_CLOSE_UP, distanceM: 0.95 },
    getFocusPoint: (_params, ctx) => getJigFocusPoint(ctx),
    run: rackFinishedAssembly,
  },
]

export const ASSEMBLY_STAGE: JobStage = {
  label: "Assembly",
  isPerUnit: true,
  steps: ASSEMBLY_STEPS,
}
