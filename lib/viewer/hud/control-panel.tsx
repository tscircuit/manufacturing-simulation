import type { Ref } from "react"
import {
  BATCH_SIZE,
  FOLDING_TABLE,
  TABLE_PLACEMENTS,
} from "lib/layout/station-layout"
import type { ScenarioId } from "lib/simulation/scenarios"
import type { SimulationMode } from "lib/simulation/sim-context"

const SPEED_OPTIONS = [0.5, 1, 2, 4, 8]

export function ControlPanel(props: {
  detailsRef: Ref<HTMLDetailsElement>
  mode: SimulationMode
  isPaused: boolean
  speed: number
  onModeChange: (mode: SimulationMode) => void
  onScenarioStart: (scenarioId: ScenarioId) => void
  onPauseToggle: () => void
  onSpeedChange: (speed: number) => void
  onReset: () => void
}) {
  const tableHeightInches = Math.round(FOLDING_TABLE.topHeightM / 0.0254)
  return (
    <section className="panel ctl">
      <details open ref={props.detailsRef}>
        <summary>
          <span>
            <span className="eyebrow">2325 · Unit 322</span>
            <br />
            Line sim v2
          </span>
        </summary>
        <div className="body">
          <div className="grp">
            <span className="eyebrow">Mode</span>
            <div className="seg">
              <button
                type="button"
                aria-pressed={props.mode === "simulation"}
                onClick={() => props.onModeChange("simulation")}
              >
                Simulation
              </button>
              <button
                type="button"
                aria-pressed={props.mode === "game"}
                onClick={() => props.onModeChange("game")}
              >
                Game
              </button>
            </div>
          </div>
          <div className="grp stack">
            <span className="eyebrow">Scenario</span>
            <button
              type="button"
              onClick={() => props.onScenarioStart("walk_floor")}
            >
              Walk the floor
            </button>
            <button
              type="button"
              onClick={() => props.onScenarioStart("pick_up_screwdriver")}
            >
              Pick up the screwdriver
            </button>
            <button
              type="button"
              onClick={() => props.onScenarioStart("run_batch")}
            >
              Run a batch of {BATCH_SIZE}, start to ship
            </button>
            <button
              type="button"
              onClick={() => props.onScenarioStart("refill_spacers")}
            >
              Collect prints, refill spacers
            </button>
          </div>
          <div className="grp">
            <span className="eyebrow">Clock</span>
            <div className="row">
              <button
                type="button"
                aria-pressed={props.isPaused}
                onClick={props.onPauseToggle}
              >
                {props.isPaused ? "Resume" : "Pause"}
              </button>
              <select
                aria-label="Simulation speed"
                value={props.speed}
                onChange={(event) =>
                  props.onSpeedChange(Number(event.target.value))
                }
              >
                {SPEED_OPTIONS.map((speed) => (
                  <option key={speed} value={speed}>
                    {speed}×
                  </option>
                ))}
              </select>
              <button type="button" onClick={props.onReset}>
                Reset
              </button>
            </div>
          </div>
          <dl className="facts">
            <dt>Operator</dt>
            <dd>6′2″ · 1.88 m</dd>
            <dt>Floor</dt>
            <dd>18′3½″ × 47′5¼″</dd>
            <dt>Tables</dt>
            <dd>
              {Object.keys(TABLE_PLACEMENTS).length} × 6′ folding,{" "}
              {tableHeightInches}″ high
            </dd>
          </dl>
        </div>
      </details>
    </section>
  )
}
