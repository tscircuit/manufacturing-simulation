import { Vector3 } from "three"
import { STATIONS } from "lib/layout/station-layout"
import { getJigFocusPoint, getPointInTableFrame } from "lib/job/bench-frames"
import type { JobStep } from "lib/job/job-step"
import {
  returnScrewdriver,
  steadyMotor,
  takeScrewdriver,
} from "lib/job/screwdriver-motions"
import { BACKFACE_SPACER } from "lib/models/backface-spacer"
import { CONTROLLER_PCB } from "lib/models/controller-pcb"
import { NEMA17 } from "lib/models/nema17-motor"
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
import {
  ASSEMBLY_BENCH_SPOTS,
  IDENTITY_QUATERNION,
} from "lib/world/bench-spots"

/** How far a screw backs out (or drives in) while turning. */
const SCREW_TRAVEL_M = 0.0175
const SCREW_TURN_RADIANS = 15
const SCREW_DRIVE_SECONDS = 1.4
/** Spacer (4 mm) plus PCB sit on the back face; screws seat on top of the PCB. */
const PCB_TOP_ABOVE_MOUNT_FACE_M =
  NEMA17.backfaceHeightM +
  BACKFACE_SPACER.baseHeightM +
  BACKFACE_SPACER.sleeveHeightM +
  CONTROLLER_PCB.thicknessM
const LONG_SCREW_SHANK_M = 0.0165

const ASSEMBLY_CLOSE_UP = {
  azimuthRadians: 2.5,
  elevationRadians: 0.6,
  distanceM: 0.55,
}

function* setSpacerDownAndLoadMotor(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const bench = world.tables.assembly_bench
  ctx.statusText = "Setting the spacer on the bench"
  yield* moveObject(
    {
      object: world.spacer,
      hand: operator.rightHand,
      parent: bench,
      localPosition: ASSEMBLY_BENCH_SPOTS.spacerRest,
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 0.8,
      arcHeightM: 0.05,
    },
    ctx,
  )
  yield* releaseHand(operator.rightHand)

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
      parent: bench,
      localPosition: ASSEMBLY_BENCH_SPOTS.jigTop,
      localQuaternion: IDENTITY_QUATERNION,
      liftHeightM: 0.04,
    },
    ctx,
  )
  yield* releaseHand(operator.leftHand)
}

function* removeBackfaceScrews(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const bench = world.tables.assembly_bench
  const { screwdriver } = world
  ctx.statusText = "Picking up the screwdriver"
  yield* runInParallel([steadyMotor(ctx), takeScrewdriver(ctx)])

  for (const [index, backfaceScrew] of world.motor.backfaceScrews.entries()) {
    const screw = backfaceScrew.group
    ctx.statusText = `Removing backface screw ${index + 1} of 4`
    yield* moveObject(
      {
        object: screwdriver.group,
        hand: operator.rightHand,
        parent: bench,
        localPosition: getPointInTableFrame(
          {
            tableId: "assembly_bench",
            object: screw,
            localPoint: new Vector3(0, 0.003, 0),
          },
          ctx,
        ),
        localQuaternion: IDENTITY_QUATERNION,
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
        screw.position.y = screwStartYM + SCREW_TRAVEL_M * progress
        screw.rotation.y = SCREW_TURN_RADIANS * progress
        screwdriver.spinningPart.rotation.y = SCREW_TURN_RADIANS * progress
        screwdriver.group.position.y = toolStartYM + SCREW_TRAVEL_M * progress
      },
    })

    // Carry the screw on the bit to the dish and drop it on its side.
    screwdriver.group.attach(screw)
    const { screwDish } = ASSEMBLY_BENCH_SPOTS
    yield* moveObject(
      {
        object: screwdriver.group,
        hand: operator.rightHand,
        parent: bench,
        localPosition: new Vector3(
          screwDish.x,
          screwDish.y + 0.035,
          screwDish.z,
        ),
        localQuaternion: IDENTITY_QUATERNION,
        durationSeconds: 0.55,
        arcHeightM: 0.03,
      },
      ctx,
    )
    bench.attach(screw)
    const dropStartPosition = screw.position.clone()
    const dropStartQuaternion = screw.quaternion.clone()
    const restPosition = new Vector3(
      screwDish.x - 0.004,
      screwDish.y + 0.0048,
      screwDish.z + (index - 1.5) * 0.009,
    )
    const restQuaternion = IDENTITY_QUATERNION.clone().setFromAxisAngle(
      new Vector3(0, 0, 1),
      Math.PI / 2,
    )
    yield* tween({
      durationSeconds: 0.22,
      onProgress: (progress) => {
        screw.position.lerpVectors(dropStartPosition, restPosition, progress)
        screw.quaternion
          .copy(dropStartQuaternion)
          .slerp(restQuaternion, progress)
      },
    })
    world.screwsInDish.push(screw)
  }
  ctx.statusText = "Setting the screwdriver down"
  yield* returnScrewdriver(ctx)
  yield* releaseHand(operator.leftHand)
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
    object: world.pcb,
    localGripPoint: new Vector3(0, 0.002, 0.02),
    fingerCurl: 1,
    durationSeconds: 0.8,
  })
  yield* moveObject(
    {
      object: world.pcb,
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

function* fastenPcb(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const bench = world.tables.assembly_bench
  const { screwdriver, motor } = world
  const halfPitchM = NEMA17.screwPitchM / 2
  ctx.statusText = "Picking up the screwdriver"
  yield* runInParallel([steadyMotor(ctx), takeScrewdriver(ctx)])

  for (const [index, screw] of world.screwsInDish.entries()) {
    const { corner } = motor.backfaceScrews[index]
    ctx.statusText = `Driving screw ${index + 1} of 4`
    yield* moveObject(
      {
        object: screwdriver.group,
        hand: operator.rightHand,
        parent: bench,
        localPosition: getPointInTableFrame(
          {
            tableId: "assembly_bench",
            object: screw,
            localPoint: new Vector3(0, 0.004, 0),
          },
          ctx,
        ),
        localQuaternion: IDENTITY_QUATERNION,
        durationSeconds: index === 0 ? 0.9 : 0.55,
        arcHeightM: 0.035,
      },
      ctx,
    )
    // Pick the screw up on the bit, standing it upright.
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

    const holeX = corner.xSign * halfPitchM
    const holeZ = corner.zSign * halfPitchM
    const screwStartYM = PCB_TOP_ABOVE_MOUNT_FACE_M + LONG_SCREW_SHANK_M
    yield* moveObject(
      {
        object: screwdriver.group,
        hand: operator.rightHand,
        parent: bench,
        localPosition: getPointInTableFrame(
          {
            tableId: "assembly_bench",
            object: motor.group,
            localPoint: new Vector3(holeX, screwStartYM + 0.003, holeZ),
          },
          ctx,
        ),
        localQuaternion: IDENTITY_QUATERNION,
        durationSeconds: 0.65,
        arcHeightM: 0.03,
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
  world.screwsInDish.length = 0
  ctx.statusText = "Setting the screwdriver down"
  yield* returnScrewdriver(ctx)
  yield* releaseHand(operator.leftHand)
}

function* pickUpMotorAssembly(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { jigTop } = ASSEMBLY_BENCH_SPOTS
  ctx.statusText = "Lifting the finished motor + PCB assembly out of the jig"
  yield* grabObject({
    hand: operator.rightHand,
    object: world.motor.group,
    localGripPoint: new Vector3(0, 0.036, 0.021),
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
    label: "Set spacer down, load motor in jig",
    station: STATIONS.assembly,
    closeUpView: { ...ASSEMBLY_CLOSE_UP, distanceM: 0.95 },
    getFocusPoint: getJigFocusPoint,
    run: setSpacerDownAndLoadMotor,
  },
  {
    label: "Remove 4 backface screws",
    station: STATIONS.assembly,
    closeUpView: ASSEMBLY_CLOSE_UP,
    getFocusPoint: getJigFocusPoint,
    run: removeBackfaceScrews,
  },
  {
    label: "Fit spacer on the backface",
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
    label: "Fasten PCB with 4 screws",
    station: STATIONS.assembly,
    closeUpView: ASSEMBLY_CLOSE_UP,
    getFocusPoint: getJigFocusPoint,
    run: fastenPcb,
  },
  {
    label: "Pick up motor assembly",
    station: STATIONS.assembly,
    closeUpView: { ...ASSEMBLY_CLOSE_UP, distanceM: 0.8 },
    getFocusPoint: getJigFocusPoint,
    run: pickUpMotorAssembly,
  },
]
