import type { GameActionKind } from "lib/simulation/manufacturing-simulation"
import type { HudSnapshot } from "lib/viewer/hud-snapshot"

const SIMULATION_HINT =
  "Drag to orbit · scroll or pinch to zoom · right-drag to pan"
const GAME_HINT =
  "WASD or arrows to walk · E run the bench, again to pause · walk to a blue circle and E to collect prints or labels · C carry on · R carry what is ready to the next bench · F screwdriver · M sound · drag to orbit · scroll to zoom"
const TOUCH_SIMULATION_HINT =
  "Drag to look around · pinch to zoom · open Line simulation for scenarios"
const TOUCH_GAME_HINT =
  "Touch the left side to walk · drag the right side to look · pinch to zoom · tap a prompt or a round button"

/** The actions available now, as key letter, label and action. */
export function getPromptActions(
  hud: HudSnapshot,
): Array<{ key: string; label: string; kind: GameActionKind }> {
  const prompts: Array<{ key: string; label: string; kind: GameActionKind }> =
    []
  if (hud.benchPromptLabel)
    prompts.push({ key: "E", label: hud.benchPromptLabel, kind: "bench" })
  if (hud.resumePromptLabel)
    prompts.push({ key: "C", label: hud.resumePromptLabel, kind: "resume" })
  if (hud.carryPromptLabel)
    prompts.push({ key: "R", label: hud.carryPromptLabel, kind: "carry" })
  if (hud.screwdriverPromptLabel)
    prompts.push({
      key: "F",
      label: hud.screwdriverPromptLabel,
      kind: "screwdriver",
    })
  return prompts
}

/** What's happening, what you can do (each prompt is also a button), and how to control it. */
export function StatusBar(props: {
  hud: HudSnapshot
  isTouch: boolean
  onAction: (kind: GameActionKind) => void
}) {
  const { hud, isTouch } = props
  const prompts = getPromptActions(hud)
  const hint =
    hud.mode === "game"
      ? isTouch
        ? TOUCH_GAME_HINT
        : GAME_HINT
      : isTouch
        ? TOUCH_SIMULATION_HINT
        : SIMULATION_HINT
  return (
    <div className="status" aria-live="polite">
      <div className="now">{hud.statusText}</div>
      {prompts.length > 0 && (
        <div className="prompt">
          {prompts.map((prompt) => (
            <button
              key={prompt.key}
              type="button"
              className="prompt-action"
              onClick={() => props.onAction(prompt.kind)}
            >
              <kbd>{prompt.key}</kbd> {prompt.label}
            </button>
          ))}
        </div>
      )}
      <div className="hint">{hint}</div>
    </div>
  )
}
