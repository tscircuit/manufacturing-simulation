import type { Vector3 } from "three"
import type { Station } from "lib/layout/station-layout"
import type { CloseUpView, SimContext } from "lib/simulation/sim-context"
import type { SimTask } from "lib/tasks/coroutines"

/** One timed step of the assemble-and-pack job. */
export interface JobStep {
  label: string
  /** Where the operator stands for this step. */
  station: Station
  closeUpView: CloseUpView
  getFocusPoint: (ctx: SimContext) => Vector3
  run: (ctx: SimContext) => SimTask
}
