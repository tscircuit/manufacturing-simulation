import type { HudSnapshot } from "lib/viewer/hud-snapshot"

const SIMULATION_HINT =
  "Drag to orbit · scroll or pinch to zoom · right-drag to pan"
const GAME_HINT =
  "WASD or arrows to walk · E next step or pause · C run the bench · F screwdriver · drag to orbit · scroll to zoom"

export function StatusBar(props: { hud: HudSnapshot }) {
  const { hud } = props
  const hasPrompt =
    hud.stepPromptLabel || hud.benchPromptLabel || hud.screwdriverPromptLabel
  return (
    <div className="status" aria-live="polite">
      <div className="now">{hud.statusText}</div>
      {hasPrompt && (
        <div className="prompt">
          {hud.stepPromptLabel && (
            <span>
              <kbd>E</kbd> {hud.stepPromptLabel}
            </span>
          )}
          {hud.benchPromptLabel && (
            <span>
              <kbd>C</kbd> {hud.benchPromptLabel}
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
