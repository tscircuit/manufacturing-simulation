import type { Station } from "lib/layout/station-layout"
import type { NavGrid } from "lib/navigation/nav-grid"
import type { Operator } from "lib/operator/create-operator"
import type { SimTask } from "lib/tasks/coroutines"
import type { ManufacturingWorld } from "lib/world/create-world"
import type { Scene, Vector3 } from "three"

export type SimulationMode = "simulation" | "game"

/** Camera framing for a close-up of fine work at a station. */
export interface CloseUpView {
  /** Orbit angle around the work, relative to looking over the operator's shoulder. */
  azimuthRadians: number
  elevationRadians: number
  distanceM: number
}

/** What the camera should look at while a task does fine work. */
export interface CameraHint {
  station: Station
  view: CloseUpView
  getFocusPoint: () => Vector3
}

/** Printer or label work fitted in between units of a bench run. */
export interface SideJob {
  /** Lower-case phrase, e.g. "take 6 printed label sheets to pack-out". */
  label: string
  createTask: () => SimTask
}

export interface JobProgress {
  /** Units in this job, starting from unit 1: the full batch, or just one motor. The rest stay on the foam stand. */
  unitCount: number
  /** Timing row of the step running now. */
  activeRowIndex: number | null
  /** Time spent in each timing row, summed over every unit, excluding walking between stations. */
  rowSeconds: number[]
  /** How many times each timing row has finished. */
  rowCompletedCounts: number[]
  /** Time since the batch started, including walking. */
  cycleSeconds: number
  isJobActive: boolean
  isJobComplete: boolean
  isOperatorBusy: boolean
  /** The operator picked up the screwdriver outside the job and still has it. */
  isHoldingLooseScrewdriver: boolean
  /** Asked for during a bench run; runs once the current unit is done. */
  pendingSideJob: SideJob | null
}

/** Shared state every simulation task reads and changes. */
export interface SimContext {
  scene: Scene
  world: ManufacturingWorld
  operator: Operator
  navGrid: NavGrid
  progress: JobProgress
  mode: SimulationMode
  statusText: string
  cameraHint: CameraHint | null
}
