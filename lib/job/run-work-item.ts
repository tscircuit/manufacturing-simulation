import { WORK_ITEMS } from "lib/job/job-plan"
import type { SimContext } from "lib/simulation/sim-context"
import type { SimTask } from "lib/tasks/coroutines"
import { walkToStation } from "lib/tasks/operator-motions"

export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder < 10 ? "0" : ""}${remainder.toFixed(1)}`
}

/** Why the next work item can't run, or null when it can. */
export function getNextWorkBlocker(ctx: SimContext): string | null {
  const item = WORK_ITEMS[ctx.progress.completedWorkCount]
  if (!item?.row.step.getBlocker) return null
  return item.row.step.getBlocker({ unitIndex: item.unitIndex }, ctx)
}

/** Walk to the next work item's station and run it, recording it as active while it runs. */
export function* runNextWorkItem(ctx: SimContext): SimTask {
  const { progress } = ctx
  const item = WORK_ITEMS[progress.completedWorkCount]
  if (!item) return
  const { step } = item.row
  const params = { unitIndex: item.unitIndex }
  progress.isJobActive = true
  yield* walkToStation(step.station, ctx)
  progress.isOperatorBusy = true
  progress.activeWorkIndex = item.workIndex
  ctx.cameraHint = {
    station: step.station,
    view: step.closeUpView,
    getFocusPoint: () => step.getFocusPoint(params, ctx),
  }
  yield* step.run(params, ctx)
  progress.activeWorkIndex = null
  progress.completedWorkCount = item.workIndex + 1
  progress.rowCompletedCounts[item.row.rowIndex] += 1
  progress.isOperatorBusy = false
  ctx.cameraHint = null
  if (progress.completedWorkCount >= WORK_ITEMS.length) {
    progress.isJobActive = false
    progress.isJobComplete = true
    ctx.statusText = `Batch shipped. Cycle time ${formatSeconds(progress.cycleSeconds)}`
  }
}

/**
 * Run work items one after another while they belong to `tableId`, or every
 * remaining item when `tableId` is null. Stops early with a status message
 * when the next item is blocked.
 */
export function* runWorkUntilBenchChanges(
  params: { tableId: string | null },
  ctx: SimContext,
): SimTask {
  for (;;) {
    const item = WORK_ITEMS[ctx.progress.completedWorkCount]
    if (!item) return
    if (params.tableId !== null && item.tableId !== params.tableId) return
    const blocker = getNextWorkBlocker(ctx)
    if (blocker) {
      ctx.statusText = blocker
      return
    }
    yield* runNextWorkItem(ctx)
    // A full-line run stops if the user takes control.
    if (params.tableId === null && ctx.mode !== "simulation") return
  }
}
