import type { Station } from "lib/layout/station-layout"
import type { CloseUpView, SimContext } from "lib/simulation/sim-context"
import type { SimTask } from "lib/tasks/coroutines"
import type { Vector3 } from "three"

/** Which unit of the batch a step is working on; 0 for one-off steps. */
export interface UnitParams {
  unitIndex: number
}

/** One timed step of the line. Per-unit steps run once for each unit in the batch. */
export interface JobStep {
  label: string
  /** Where the operator stands for this step. */
  station: Station
  closeUpView: CloseUpView
  getFocusPoint: (params: UnitParams, ctx: SimContext) => Vector3
  run: (params: UnitParams, ctx: SimContext) => SimTask
  /** Why the step can't run right now (e.g. the spacer basket is empty), or null. */
  getBlocker?: (params: UnitParams, ctx: SimContext) => string | null
}

/** A group of steps at one bench, run once or once per unit. */
export interface JobStage {
  label: string
  isPerUnit: boolean
  steps: JobStep[]
}
