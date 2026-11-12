import { ASSEMBLY_JOB_STEPS } from "lib/job/assembly-job-steps"
import type { SimContext } from "lib/simulation/sim-context"
import type { SimTask } from "lib/tasks/coroutines"

export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder < 10 ? "0" : ""}${remainder.toFixed(1)}`
}

/** Run one job step at the current station, recording it as active while it runs. */
export function* runJobStep(
  params: { stepIndex: number },
  ctx: SimContext,
): SimTask {
  const { stepIndex } = params
  const step = ASSEMBLY_JOB_STEPS[stepIndex]
  const { progress } = ctx
  progress.isOperatorBusy = true
  progress.isJobActive = true
  progress.activeStepIndex = stepIndex
  ctx.cameraHint = {
    station: step.station,
    view: step.closeUpView,
    getFocusPoint: () => step.getFocusPoint(ctx),
  }
  yield* step.run(ctx)
  progress.activeStepIndex = null
  progress.completedStepCount = stepIndex + 1
  progress.isOperatorBusy = false
  ctx.cameraHint = null
  if (progress.completedStepCount >= ASSEMBLY_JOB_STEPS.length) {
    progress.isJobActive = false
    progress.isJobComplete = true
    ctx.statusText = `Unit packed. Cycle time ${formatSeconds(progress.cycleSeconds)}`
  }
}
