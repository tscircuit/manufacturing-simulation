import type { HudSnapshot } from "lib/viewer/hud-snapshot"

const SIMULATION_HINT =
  "Drag to orbit · scroll or pinch to zoom · right-drag to pan"
const GAME_HINT =
  "WASD or arrows to walk · E run the bench, again to pause and resume · R carry what is ready to the next bench · F screwdriver · M sound · drag to orbit · scroll to zoom"

export function StatusBar(props: { hud: HudSnapshot }) {
  const { hud } = props
  const hasPrompt =
    hud.benchPromptLabel || hud.carryPromptLabel || hud.screwdriverPromptLabel
  return (
    <div className="status" aria-live="polite">
      <div className="now">{hud.statusText}</div>
      {hasPrompt && (
        <div className="prompt">
          {hud.benchPromptLabel && (
            <span>
              <kbd>E</kbd> {hud.benchPromptLabel}
            </span>
          )}
          {hud.carryPromptLabel && (
            <span>
              <kbd>R</kbd> {hud.carryPromptLabel}
            </span>
          )}
          {hud.screwdriverPromptLabel && (
            <span>
              <kbd>F</kbd> {hud.screwdriverPromptLabel}
            </span>
          )}
        </div>
      )}
      <div className="hint">
        {hud.mode === "game" ? GAME_HINT : SIMULATION_HINT}
      </div>
    </div>
  )
}
