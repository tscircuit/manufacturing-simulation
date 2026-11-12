import { Vector3 } from "three"
import { FOLDING_TABLE, STATIONS } from "lib/layout/station-layout"
import { getBoxFocusPoint } from "lib/job/bench-frames"
import type { JobStep } from "lib/job/job-step"
import { FOAM_INSERT, FOAM_INSERT_HEIGHT_M } from "lib/models/foam-insert"
import { MAILER_BOX } from "lib/models/mailer-box"
import { NEMA17 } from "lib/models/nema17-motor"
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
  MOTOR_ON_SIDE_QUATERNION,
  PACK_OUT_BENCH_SPOTS,
} from "lib/world/bench-spots"

const WALL_UP_RADIANS = Math.PI / 2
const TUCK_START_RADIANS = 0.5
const PACK_OUT_CLOSE_UP = {
  azimuthRadians: 2.5,
  elevationRadians: 0.6,
  distanceM: 0.7,
}
/** Motor lying on its side rests on the bottom foam's slab, centred in the pocket. */
const MOTOR_IN_FOAM_POSITION = new Vector3(
  -0.0123,
  MAILER_BOX.boardThicknessM +
    FOAM_INSERT.slabThicknessM +
    NEMA17.faceSizeM / 2,
  0,
)

function* foldBox(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { box } = world
  const bench = world.tables.pack_out_bench
  const { leftHand, rightHand } = operator
  ctx.statusText = "Setting the assembly on the bench"
  yield* moveObject(
    {
      object: world.motor.group,
      hand: rightHand,
      parent: bench,
      localPosition: PACK_OUT_BENCH_SPOTS.assemblyRest,
      localQuaternion: MOTOR_ON_SIDE_QUATERNION,
      durationSeconds: 1,
      arcHeightM: 0.05,
    },
    ctx,
  )
  yield* releaseHand(rightHand)

  ctx.statusText = "Taking a flat box blank"
  yield* grabObject({
    hand: leftHand,
    object: box.frontWall.tip,
    fingerCurl: 0.9,
    durationSeconds: 0.8,
  })
  yield* moveObject(
    {
      object: box.group,
      hand: leftHand,
      parent: bench,
      localPosition: PACK_OUT_BENCH_SPOTS.boxFolding,
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 1,
      arcHeightM: 0.06,
    },
    ctx,
  )

  ctx.statusText = "Folding the side walls up"
  yield* runInParallel([
    reachHand({
      hand: leftHand,
      getTarget: trackObjectPoint({ object: box.leftWall.tip }),
      durationSeconds: 0.5,
    }),
    reachHand({
      hand: rightHand,
      getTarget: trackObjectPoint({ object: box.rightWall.tip }),
      durationSeconds: 0.6,
    }),
  ])
  yield* tween({
    durationSeconds: 1,
    onProgress: (progress) => {
      box.leftWall.fold.rotation.z = WALL_UP_RADIANS * progress
      box.rightWall.fold.rotation.z = WALL_UP_RADIANS * progress
    },
  })

  ctx.statusText = "Folding the front and back walls up"
  yield* runInParallel([
    reachHand({
      hand: leftHand,
      getTarget: trackObjectPoint({ object: box.backWall.tip }),
      durationSeconds: 0.5,
    }),
    reachHand({
      hand: rightHand,
      getTarget: trackObjectPoint({ object: box.frontWall.tip }),
      durationSeconds: 0.5,
    }),
  ])
  yield* tween({
    durationSeconds: 1,
    onProgress: (progress) => {
      box.frontWall.fold.rotation.z = WALL_UP_RADIANS * progress
      box.backWall.fold.rotation.z = WALL_UP_RADIANS * progress
    },
  })
  yield* waitSeconds(0.2)
  yield* runInParallel([releaseHand(leftHand), releaseHand(rightHand)])
}

function* insertBottomFoam(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  ctx.statusText = "Dropping the bottom foam insert into the box"
  yield* grabObject({
    hand: operator.rightHand,
    object: world.bottomFoam,
    localGripPoint: new Vector3(0, 0.03, 0.03),
    fingerCurl: 0.8,
    durationSeconds: 0.7,
  })
  yield* liftAndPlace(
    {
      object: world.bottomFoam,
      hand: operator.rightHand,
      parent: world.box.group,
      localPosition: new Vector3(0, MAILER_BOX.boardThicknessM, 0),
      localQuaternion: IDENTITY_QUATERNION,
      liftHeightM: 0.05,
      travelSeconds: 0.7,
    },
    ctx,
  )
  yield* releaseHand(operator.rightHand)
}

function* placeAssemblyInFoam(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  ctx.statusText = "Nesting the motor assembly in the foam pocket"
  yield* grabObject({
    hand: operator.rightHand,
    object: world.motor.group,
    localGripPoint: new Vector3(-0.019, 0.02, 0.02),
    fingerCurl: 0.6,
    durationSeconds: 0.7,
  })
  yield* liftAndPlace(
    {
      object: world.motor.group,
      hand: operator.rightHand,
      parent: world.box.group,
      localPosition: MOTOR_IN_FOAM_POSITION,
      localQuaternion: MOTOR_ON_SIDE_QUATERNION,
      liftHeightM: 0.06,
      travelSeconds: 0.7,
    },
    ctx,
  )
  yield* releaseHand(operator.rightHand)
}

function* capAndCloseBox(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { box } = world
  const hand = operator.rightHand
  ctx.statusText = "Capping with the top foam insert"
  yield* grabObject({
    hand,
    object: world.topFoam,
    localGripPoint: new Vector3(0, 0.029, 0.03),
    fingerCurl: 0.8,
    durationSeconds: 0.7,
  })
  yield* liftAndPlace(
    {
      object: world.topFoam,
      hand,
      parent: box.group,
      localPosition: new Vector3(
        0,
        MAILER_BOX.boardThicknessM + FOAM_INSERT_HEIGHT_M,
        0,
      ),
      localQuaternion: IDENTITY_QUATERNION,
      liftHeightM: 0.05,
      travelSeconds: 0.7,
    },
    ctx,
  )
  yield* releaseHand(hand)

  ctx.statusText = "Closing the lid and tucking the flap"
  yield* reachHand({
    hand,
    getTarget: trackObjectPoint({ object: box.lidTip }),
    durationSeconds: 0.7,
  })
  yield* tween({
    durationSeconds: 1,
    onProgress: (progress) => {
      box.lid.rotation.z = WALL_UP_RADIANS * progress
      box.tuckFlap.rotation.z = TUCK_START_RADIANS * progress
    },
  })
  yield* tween({
    durationSeconds: 0.5,
    onProgress: (progress) => {
      box.tuckFlap.rotation.z =
        TUCK_START_RADIANS + (WALL_UP_RADIANS - TUCK_START_RADIANS) * progress
    },
  })
  yield* releaseHand(hand)
}

function* moveBoxToFinishedGoods(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { box } = world
  const bench = world.tables.pack_out_bench
  const { leftHand, rightHand } = operator
  ctx.statusText = "Carrying the packed box to finished goods"
  yield* runInParallel([
    grabObject({
      hand: leftHand,
      object: box.group,
      localGripPoint: new Vector3(-0.06, 0.04, 0.02),
      fingerCurl: 0.5,
      durationSeconds: 0.6,
    }),
    grabObject({
      hand: rightHand,
      object: box.group,
      localGripPoint: new Vector3(0.06, 0.04, 0.02),
      fingerCurl: 0.5,
      durationSeconds: 0.6,
    }),
  ])
  yield* moveObject(
    {
      object: box.group,
      hand: rightHand,
      parent: bench,
      localPosition: new Vector3(0, FOLDING_TABLE.topHeightM + 0.25, 0.34),
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 0.7,
    },
    ctx,
  )
  holdInHand({ hand: rightHand, object: box.group })
  yield* walkToStation(STATIONS.finishedGoods, ctx)
  yield* moveObject(
    {
      object: box.group,
      hand: rightHand,
      parent: bench,
      localPosition: PACK_OUT_BENCH_SPOTS.finishedGoods,
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 0.9,
      arcHeightM: 0.03,
    },
    ctx,
  )
  yield* runInParallel([releaseHand(leftHand), releaseHand(rightHand)])
}

export const PACK_OUT_STEPS: JobStep[] = [
  {
    label: "Set assembly down, fold a box",
    station: STATIONS.packOut,
    closeUpView: { ...PACK_OUT_CLOSE_UP, distanceM: 0.95 },
    getFocusPoint: getBoxFocusPoint,
    run: foldBox,
  },
  {
    label: "Insert bottom foam",
    station: STATIONS.packOut,
    closeUpView: PACK_OUT_CLOSE_UP,
    getFocusPoint: getBoxFocusPoint,
    run: insertBottomFoam,
  },
  {
    label: "Place assembly in foam",
    station: STATIONS.packOut,
    closeUpView: PACK_OUT_CLOSE_UP,
    getFocusPoint: getBoxFocusPoint,
    run: placeAssemblyInFoam,
  },
  {
    label: "Top foam, close the lid",
    station: STATIONS.packOut,
    closeUpView: PACK_OUT_CLOSE_UP,
    getFocusPoint: getBoxFocusPoint,
    run: capAndCloseBox,
  },
  {
    label: "Move box to finished goods",
    station: STATIONS.packOut,
    closeUpView: { ...PACK_OUT_CLOSE_UP, distanceM: 1.4 },
    getFocusPoint: getBoxFocusPoint,
    run: moveBoxToFinishedGoods,
  },
]
