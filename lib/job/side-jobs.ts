import { collectPrintedLabels } from "lib/job/label-collection"
import {
  collectFinishedPlates,
  getFinishedPrinters,
  refillSpacerBasket,
} from "lib/job/printer-steps"
import type { TableId } from "lib/layout/station-layout"
import type { SideJob, SimContext } from "lib/simulation/sim-context"
import type { SimTask } from "lib/tasks/coroutines"

/** Empty the finished plates into a tub and pour it into the assembly basket, start to finish. */
export function* collectPlatesAndRefill(ctx: SimContext): SimTask {
  yield* collectFinishedPlates(ctx)
  yield* refillSpacerBasket(ctx)
}

/** Printer or label work at an equipment bench that can be fitted in between units of a bench run. */
export function getSideJobAt(
  params: { tableId: TableId | null },
  ctx: SimContext,
): SideJob | null {
  const { world } = ctx
  if (params.tableId === "printer_bench") {
    const finishedCount = getFinishedPrinters(ctx).length
    if (finishedCount === 0) return null
    return {
      label: `collect ${finishedCount === 1 ? "the finished plate" : `${finishedCount} finished plates`} and refill the spacers`,
      createTask: () => collectPlatesAndRefill(ctx),
    }
  }
  if (params.tableId === "label_bench") {
    const sheetCount = world.labelPrinter.printedSheets.length
    if (sheetCount === 0) return null
    return {
      label: `take ${sheetCount} printed label ${sheetCount === 1 ? "sheet" : "sheets"} to pack-out`,
      createTask: () => collectPrintedLabels(ctx),
    }
  }
  return null
}

/** Run a side job asked for during a bench run, now that the operator is between units with empty hands. */
export function* runPendingSideJob(ctx: SimContext): SimTask {
  const sideJob = ctx.progress.pendingSideJob
  if (!sideJob) return
  ctx.progress.pendingSideJob = null
  const statusText = ctx.statusText
  ctx.statusText = `Between units: going to ${sideJob.label}`
  yield* sideJob.createTask()
  ctx.statusText = statusText
}
