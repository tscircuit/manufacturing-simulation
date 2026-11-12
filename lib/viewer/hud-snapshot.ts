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
  steps: Array<{ label: string; seconds: number; state: StepRowState }>
  walkingSeconds: number
  cycleSeconds: number
  /** E: the next step, or Pause / Resume while something runs. */
  stepPromptLabel: string | null
  /** C: run the rest of this bench. */
  benchPromptLabel: string | null
  screwdriverPromptLabel: string | null
}
