import {
  BATCH_SIZE,
  TABLE_PLACEMENTS,
  WORK_TABLE,
} from "lib/layout/station-layout"
import { LINE_STARTS, type LineStartId } from "lib/simulation/line-setup"
import type { ScenarioId } from "lib/simulation/scenarios"
import type { SimulationMode } from "lib/simulation/sim-context"
import type { Ref } from "react"

const SPEED_OPTIONS = [0.5, 1, 2, 4, 8, 16]
const LINE_START_IDS: LineStartId[] = [
  "assembly",
  "qc",
  "pack_out",
  "ship_ready",
]

export function ControlPanel(props: {
  detailsRef: Ref<HTMLDetailsElement>
  mode: SimulationMode
  jobUnitCount: number
  onJobUnitCountChange: (unitCount: number) => void
  isPaused: boolean
  speed: number
  onModeChange: (mode: SimulationMode) => void
  onScenarioStart: (scenarioId: ScenarioId) => void
  onPauseToggle: () => void
  onSpeedChange: (speed: number) => void
  onReset: () => void
  onStartAt: (startId: LineStartId) => void
  onPrintsReady: () => void
  onLabelsPrinted: () => void
}) {
  const tableHeightInches = Math.round(WORK_TABLE.topHeightM / 0.0254)
  return (
    <section className="panel ctl">
      <details open ref={props.detailsRef}>
        <summary>
          <span>
            <span className="eyebrow">2325 · Unit 322</span>
            <br />
            Line simulation
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
          <div className="grp">
            <span className="eyebrow">Simulate</span>
            <div className="seg">
              <button
                type="button"
                aria-pressed={props.jobUnitCount === BATCH_SIZE}
                onClick={() => props.onJobUnitCountChange(BATCH_SIZE)}
              >
                Full batch ({BATCH_SIZE})
              </button>
              <button
                type="button"
                aria-pressed={props.jobUnitCount === 1}
                onClick={() => props.onJobUnitCountChange(1)}
              >
                One at a time
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
              {props.jobUnitCount === 1
                ? "Run one motor, start to ship"
                : `Run a batch of ${props.jobUnitCount}, start to ship`}
            </button>
            <button
              type="button"
              onClick={() => props.onScenarioStart("refill_spacers")}
            >
              Collect prints, refill spacers
            </button>
            <button
              type="button"
              onClick={() => props.onScenarioStart("collect_labels")}
            >
              Collect labels to pack-out
            </button>
          </div>
          <div className="grp stack">
            <span className="eyebrow">
              Jump to a bench with {props.jobUnitCount} ready
            </span>
            <select
              aria-label="Start the batch at a bench"
              value=""
              onChange={(event) => {
                const startId = LINE_START_IDS.find(
                  (id) => id === event.target.value,
                )
                if (startId) props.onStartAt(startId)
              }}
            >
              <option value="" disabled>
                Choose a bench…
              </option>
              {LINE_START_IDS.map((startId) => (
                <option key={startId} value={startId}>
                  {LINE_STARTS[startId].label}
                </option>
              ))}
            </select>
          </div>
          <div className="grp stack">
            <span className="eyebrow">Equipment</span>
            <div className="row">
              <button type="button" onClick={props.onPrintsReady}>
                3D prints are ready
              </button>
              <button type="button" onClick={props.onLabelsPrinted}>
                Labels printed
              </button>
            </div>
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
              {Object.keys(TABLE_PLACEMENTS).length} × 6′ standing desks,{" "}
              {tableHeightInches}″ high
            </dd>
          </dl>
        </div>
      </details>
    </section>
  )
}
