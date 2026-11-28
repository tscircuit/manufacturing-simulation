import { useEffect, useRef, useState } from "react"
import { duration, phaseAt, phases } from "./plan"
import { createSurveyScene, type SurveyView } from "./scene"
import "./field-survey.css"

const timeLabel = (seconds: number) =>
  Math.floor(seconds / 60) +
  ":" +
  String(Math.floor(seconds % 60)).padStart(2, "0")

export function FieldSurveyViewer() {
  const host = useRef<HTMLDivElement>(null)
  const playback = useRef({
    time: 0,
    playing: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    speed: 1,
    view: "follow" as SurveyView,
  })
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(playback.current.playing)
  const [view, setView] = useState<SurveyView>("follow")
  const [speed, setSpeed] = useState(1)
  const [sceneError, setSceneError] = useState(false)
  const phase = phaseAt(time)
  const scanning =
    phase.id === "ambient" || phase.id === "hold" || phase.id === "step"
  const phaseEnd = phases[phases.indexOf(phase) + 1]?.start ?? duration
  const vertical = (time - phase.start) / (phaseEnd - phase.start) >= 0.5

  useEffect(() => {
    if (!host.current) return
    let scene: ReturnType<typeof createSurveyScene> | undefined
    try {
      scene = createSurveyScene(host.current)
    } catch (error) {
      console.error("Unable to initialize the survey view", error)
      setSceneError(true)
    }
    let request = 0
    let last = performance.now()
    let reported = -1
    const frame = (now: number) => {
      const state = playback.current
      if (state.playing && !document.hidden) {
        state.time = Math.min(
          duration,
          state.time + Math.min((now - last) / 1000, 0.5) * state.speed,
        )
        if (state.time === duration) {
          state.playing = false
          setPlaying(false)
        }
      }
      last = now
      scene?.draw(state.time, state.view)
      if (Math.floor(state.time * 8) !== reported) {
        reported = Math.floor(state.time * 8)
        setTime(state.time)
      }
      request = requestAnimationFrame(frame)
    }
    request = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(request)
      scene?.dispose()
    }
  }, [])

  const selectView = (next: SurveyView) => {
    playback.current.view = next
    setView(next)
  }
  const seek = (next: number) => {
    playback.current.time = next
    setTime(next)
  }
  const toggle = () => {
    if (playback.current.time >= duration) seek(0)
    playback.current.playing = !playback.current.playing
    setPlaying(playback.current.playing)
  }
  const chooseSpeed = () => {
    const next = speed === 1 ? 2 : speed === 2 ? 0.5 : 1
    playback.current.speed = next
    setSpeed(next)
  }
  const routeView = view === "bench" && !scanning ? "follow" : view
  return (
    <main className="fs-page">
      <header className="fs-heading">
        <div className="fs-heading-text">
          <div className="fs-context">
            <span className="fs-mark" aria-hidden="true" />
            Manufacturing simulation <span className="fs-slash">/</span> NEMA17
          </div>
          <h1>Outdoor emissions survey</h1>
        </div>
        <div className="fs-route">
          <b>
            2325 Third Street <span aria-hidden="true">→</span> Esprit Park
          </b>
          <span>Dogpatch, San Francisco</span>
        </div>
      </header>
      <div className="fs-workspace">
        <section className="fs-viewport" aria-label="Scenario playback">
          <div className="fs-stage">
            <div className="fs-canvas" ref={host} />
            {sceneError && (
              <p className="fs-error" role="status">
                The 3D scene needs WebGL. The sequence and playback controls are
                available below.
              </p>
            )}
            <div className="fs-views" role="group" aria-label="Camera">
              {(
                [
                  "follow",
                  "plan",
                  ...(scanning ? ["bench"] : []),
                ] as SurveyView[]
              ).map((mode) => (
                <button
                  key={mode}
                  aria-pressed={routeView === mode}
                  onClick={() => selectView(mode)}
                >
                  {mode === "follow"
                    ? "Follow"
                    : mode === "plan"
                      ? "Route view"
                      : "Motor close-up"}
                </button>
              ))}
            </div>
            <div className="fs-location">
              <span className="fs-pin" aria-hidden="true" />
              {time >= 94 ? "2325 Third Street" : phase.location}
            </div>
          </div>
          <div className="fs-transport">
            <button
              className="fs-play"
              onClick={toggle}
              aria-label={
                playing
                  ? "Pause simulation"
                  : time >= duration
                    ? "Replay simulation"
                    : "Play simulation"
              }
            >
              <span
                aria-hidden="true"
                className={playing ? "fs-pause-icon" : "fs-play-icon"}
              />
              <span>
                {playing ? "Pause" : time >= duration ? "Replay" : "Play"}
              </span>
            </button>
            <span className="fs-time">
              {timeLabel(time)} <i>/</i> {timeLabel(duration)}
            </span>
            <input
              aria-label="Simulation timeline"
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={time}
              onChange={(e) => seek(Number(e.currentTarget.value))}
              style={{
                background:
                  "linear-gradient(to right, #e5aa6d " +
                  (time / duration) * 100 +
                  "%, #5c6960 " +
                  (time / duration) * 100 +
                  "%)",
              }}
            />
            <button
              className="fs-speed"
              aria-label={"Playback speed " + speed + "×. Change speed"}
              onClick={chooseSpeed}
            >
              {speed}×
            </button>
          </div>
        </section>
        <aside className="fs-sequence">
          <div className="fs-sequence-heading">
            <h2>Field sequence</h2>
            <span>{timeLabel(duration)}</span>
          </div>
          <nav className="fs-chapters" aria-label="Field sequence">
            {phases.map((item) => (
              <button
                className="fs-chapter"
                key={item.id}
                aria-current={phase.id === item.id ? "step" : undefined}
                data-done={item.start < phase.start}
                onClick={() => seek(item.start)}
              >
                <span aria-hidden="true" className="fs-dot" />
                <span>{item.title}</span>
                <time>{timeLabel(item.start)}</time>
              </button>
            ))}
          </nav>
          <label className="fs-mobile-select">
            Field sequence
            <select
              aria-label="Jump to a field phase"
              value={phase.id}
              onChange={(e) =>
                seek(
                  phases.find((item) => item.id === e.currentTarget.value)!
                    .start,
                )
              }
            >
              {phases.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <section className="fs-notes" aria-label="Current operation">
            <div className="fs-band">
              <span aria-hidden="true" className="fs-signal">
                ▂▅▇
              </span>
              30 MHz–3 GHz pre-scan
            </div>
            <p>
              {time >= 94
                ? "The equipment is back at HQ. Replay the trip or choose a field phase to inspect the setup."
                : phase.detail}
            </p>
            {scanning && (
              <div className="fs-readout">
                <span>Antenna</span>
                <b>{vertical ? "Vertical" : "Horizontal"}</b>
                <span>Motor</span>
                <b>
                  {phase.id === "ambient"
                    ? "Unpowered"
                    : phase.id === "hold"
                      ? "Holding"
                      : "Stepping"}
                </b>
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  )
}
