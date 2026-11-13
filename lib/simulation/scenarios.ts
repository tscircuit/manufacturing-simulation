import { runFullBatch } from "lib/job/bench-work"
import { collectPrintedLabels } from "lib/job/label-collection"
import {
  collectFinishedPlates,
  getFinishedPrinters,
  refillSpacerBasket,
} from "lib/job/printer-steps"
import { pickUpLooseScrewdriver } from "lib/job/screwdriver-motions"
import { PATROL_ROUTE, STATIONS } from "lib/layout/station-layout"
import type { SimContext } from "lib/simulation/sim-context"
import { type SimTask, waitSeconds } from "lib/tasks/coroutines"
import { walkTo, walkToStation } from "lib/tasks/operator-motions"

export type ScenarioId =
  | "walk_floor"
  | "pick_up_screwdriver"
  | "run_batch"
  | "refill_spacers"
  | "collect_labels"

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

/** Run the line from wherever it is now, bench by bench, until the carton ships. */
export function* runBatchScenario(ctx: SimContext): SimTask {
  yield* runFullBatch(ctx)
}

/** Collect every finished printer plate and pour the spacers into the assembly basket. */
export function* refillSpacersScenario(ctx: SimContext): SimTask {
  if (getFinishedPrinters(ctx).length === 0 && !ctx.world.carriedTub) {
    ctx.statusText =
      "No printer has a finished plate yet. Use “3D prints ready” to finish them."
    return
  }
  yield* collectFinishedPlates(ctx)
  yield* refillSpacerBasket(ctx)
}

/** Take the printed label sheets from the label printer to pack-out. */
export function* collectLabelsScenario(ctx: SimContext): SimTask {
  if (ctx.world.labelPrinter.printedSheets.length === 0) {
    ctx.statusText =
      "The label printer hasn't printed any sheets yet. Use “Labels printed” to fill its tray."
    return
  }
  yield* collectPrintedLabels(ctx)
}
