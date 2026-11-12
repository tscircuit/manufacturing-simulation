import {
  PATROL_ROUTE,
  STATIONS,
  TABLE_PLACEMENTS,
} from "lib/layout/station-layout"
import { ASSEMBLY_JOB_STEPS } from "lib/job/assembly-job-steps"
import { runJobStep } from "lib/job/run-job-step"
import { pickUpLooseScrewdriver } from "lib/job/screwdriver-motions"
import type { SimContext } from "lib/simulation/sim-context"
import { type SimTask, waitSeconds } from "lib/tasks/coroutines"
import { walkTo, walkToStation } from "lib/tasks/operator-motions"

export type ScenarioId =
  | "walk_floor"
  | "pick_up_screwdriver"
  | "assemble_and_pack"

const PATROL_PAUSE_SECONDS = 0.5

/** Walk the patrol loop forever. */
export function* walkFloorScenario(ctx: SimContext): SimTask {
  ctx.statusText = "Walking the floor"
  for (
    let waypointIndex = 0;
    ;
    waypointIndex = (waypointIndex + 1) % PATROL_ROUTE.length
  ) {
    yield* walkTo(PATROL_ROUTE[waypointIndex], ctx)
    yield* waitSeconds(PATROL_PAUSE_SECONDS)
  }
}

export function* pickUpScrewdriverScenario(ctx: SimContext): SimTask {
  ctx.statusText = "Walking to the assembly bench"
  yield* walkToStation(STATIONS.assembly, ctx)
  yield* pickUpLooseScrewdriver(ctx)
}

/** Run every remaining job step, walking between stations. Stops if the user takes control. */
export function* assembleAndPackScenario(ctx: SimContext): SimTask {
  const { progress } = ctx
  while (progress.completedStepCount < ASSEMBLY_JOB_STEPS.length) {
    const stepIndex = progress.completedStepCount
    const step = ASSEMBLY_JOB_STEPS[stepIndex]
    progress.isJobActive = true
    ctx.statusText = `Walking to the ${TABLE_PLACEMENTS[step.station.tableId].label}`
    yield* walkToStation(step.station, ctx)
    yield* runJobStep({ stepIndex }, ctx)
    if (ctx.mode !== "simulation") return
  }
}
