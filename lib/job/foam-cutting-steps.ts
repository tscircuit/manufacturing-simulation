import { Vector3 } from "three"
import type { JobStep } from "lib/job/job-step"
import { STATIONS } from "lib/layout/station-layout"
import {
  CUTTER_HOME,
  FOAM_SHEET_SURFACE_Y_M,
} from "lib/models/foam-cutting-station"
import { FOAM_INSERT, FOAM_INSERT_HEIGHT_M } from "lib/models/foam-insert"
import type { SimContext } from "lib/simulation/sim-context"
import { type SimTask, tween, waitSeconds } from "lib/tasks/coroutines"
import {
  bringHandToCarryPose,
  grabObject,
  holdInHand,
  moveObject,
  reachHand,
  releaseHand,
  trackObjectPoint,
} from "lib/tasks/operator-motions"
import { IDENTITY_QUATERNION } from "lib/world/bench-spots"

function* moveCutter(
  ctx: SimContext,
  target: Vector3,
  durationSeconds: number,
): SimTask {
  const { gantry, head } = ctx.world.foamCutting
  const start = new Vector3(head.position.x, head.position.y, gantry.position.z)
  yield* tween({
    durationSeconds,
    onProgress: (progress) => {
      head.position.x = start.x + (target.x - start.x) * progress
      head.position.y = start.y + (target.y - start.y) * progress
      gantry.position.z = start.z + (target.z - start.z) * progress
    },
  })
}

function* traceCut(
  ctx: SimContext,
  corners: Vector3[],
  depthM: number,
): SimTask {
  const start = corners[0].clone()
  start.y = CUTTER_HOME.y
  yield* moveCutter(ctx, start, 0.5)
  for (const corner of [...corners, corners[0]]) {
    const target = corner.clone()
    target.y = -depthM
    yield* moveCutter(ctx, target, 0.3)
  }
  yield* moveCutter(ctx, start, 0.22)
}

function* collectFoamInserts(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { foamCutting, foamInsertPair, bottomFoam, topFoam } = world
  const hand = operator.leftHand
  const [bottomProfile, topProfile] = foamCutting.profiles
  bottomFoam.position.copy(bottomProfile.center)
  bottomFoam.position.y -= FOAM_INSERT_HEIGHT_M
  // Both pockets face up during cutting. Flip the cap when stacking the pair.
  topFoam.position.copy(topProfile.center)
  topFoam.rotation.x = Math.PI
  foamInsertPair.position.set(0.25, FOAM_SHEET_SURFACE_Y_M, 0.22)
  foamCutting.group.add(bottomFoam, topFoam, foamInsertPair)

  ctx.statusText = "Lifting the cut inserts out of the sheet"
  const gripZ = FOAM_INSERT.depthM / 2
  yield* grabObject({
    hand,
    object: bottomFoam,
    localGripPoint: new Vector3(0, FOAM_INSERT_HEIGHT_M, gripZ),
  })
  yield* moveObject(
    {
      object: bottomFoam,
      hand,
      parent: foamInsertPair,
      localPosition: new Vector3(),
      localQuaternion: IDENTITY_QUATERNION,
      arcHeightM: 0.09,
    },
    ctx,
  )
  yield* grabObject({
    hand,
    object: topFoam,
    localGripPoint: new Vector3(0, 0, -gripZ),
  })
  yield* moveObject(
    {
      object: topFoam,
      hand,
      parent: foamInsertPair,
      localPosition: new Vector3(0, FOAM_INSERT_HEIGHT_M, 0),
      localQuaternion: IDENTITY_QUATERNION,
      arcHeightM: 0.09,
    },
    ctx,
  )
  holdInHand({ hand, object: foamInsertPair })
  yield* bringHandToCarryPose(hand, ctx)
}

function* cutFoam(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const { foamCutting } = world
  const hand = operator.leftHand
  ctx.statusText = "Starting the foam cutter"
  yield* reachHand({
    hand,
    getTarget: trackObjectPoint({
      object: foamCutting.startButton,
      localPoint: new Vector3(0, 0.004, 0),
    }),
  })
  yield* waitSeconds(0.2)
  yield* releaseHand(hand)

  ctx.statusText = "Cutting foam inserts to fit the mailer"
  for (const profile of foamCutting.profiles) {
    yield* traceCut(ctx, profile.pocket, FOAM_INSERT.frameHeightM)
    yield* traceCut(ctx, profile.perimeter, FOAM_INSERT_HEIGHT_M)
  }
  yield* moveCutter(ctx, CUTTER_HOME, 0.55)
  foamCutting.uncutSheet.visible = false
  foamCutting.cutSheet.visible = true
  yield* collectFoamInserts(ctx)
}

export const FOAM_CUTTING_STEPS: JobStep[] = [
  {
    label: "Cut foam to fit the mailer",
    station: STATIONS.foamCutting,
    closeUpView: {
      azimuthRadians: 1.05,
      elevationRadians: 0.93,
      distanceM: 1.6,
    },
    getFocusPoint: ({ world }) =>
      world.foamCutting.group.localToWorld(new Vector3(0, 0.1, 0.04)),
    run: cutFoam,
  },
]
