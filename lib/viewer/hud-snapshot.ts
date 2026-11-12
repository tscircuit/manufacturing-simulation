import type { CameraMode } from "lib/viewer/camera-rig"
import type { SimulationMode } from "lib/simulation/sim-context"

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
    runCount: number
    state: StepRowState
  }>
  walkingSeconds: number
  cycleSeconds: number
  /** E: run this bench, collect prints or refill; Pause / Resume while something runs. */
  benchPromptLabel: string | null
  screwdriverPromptLabel: string | null
  spacersInBasket: number
  /** One status line per 3D printer. */
  printerLines: string[]
}
