import type { SimulationMode } from "lib/simulation/sim-context"
import type { CameraMode } from "lib/viewer/camera-rig"
import type { UnitStage } from "lib/world/create-world"

export type StepRowState = "pending" | "active" | "done"

/** Everything the HUD panels render, rebuilt a few times a second. */
export interface HudSnapshot {
  mode: SimulationMode
  statusText: string
  isPaused: boolean
  speed: number
  cameraMode: CameraMode
  isAutoCloseUp: boolean
  steps: Array<{
    label: string
    seconds: number
    completedCount: number
    /** Null for moves that happen as often as the line needs. */
    runCount: number | null
    state: StepRowState
  }>
  walkingSeconds: number
  cycleSeconds: number
  /** E: run this bench, collect prints or refill; Pause / Resume while something runs. */
  benchPromptLabel: string | null
  /** R: move what's ready on to the next bench. */
  carryPromptLabel: string | null
  screwdriverPromptLabel: string | null
  unitsByStage: Array<{ stage: UnitStage; count: number }>
  labelsAtPackOut: number
  /** Printed label sheets waiting in the Epson's tray. */
  printedLabelSheets: number
  spacersInBasket: number
  /** One status line per 3D printer. */
  printerLines: string[]
}
