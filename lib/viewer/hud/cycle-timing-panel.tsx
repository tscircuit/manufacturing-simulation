import type { Ref } from "react"
import { formatSeconds } from "lib/job/run-job-step"
import type { HudSnapshot } from "lib/viewer/hud-snapshot"

export function CycleTimingPanel(props: {
  detailsRef: Ref<HTMLDetailsElement>
  hud: HudSnapshot
}) {
  const { hud } = props
  return (
    <section className="panel timing">
      <details open ref={props.detailsRef}>
        <summary>
          <span>Cycle timing</span>
          <span className="t">{formatSeconds(hud.cycleSeconds)}</span>
        </summary>
        <ol className="rows">
          {hud.steps.map((step, index) => (
            <li key={step.label} className={step.state}>
              <span className="num">
                {step.state === "done" ? "✓" : index + 1}
              </span>
              <span>{step.label}</span>
              <span className="t">
                {step.seconds > 0 ? formatSeconds(step.seconds) : "–"}
              </span>
            </li>
          ))}
        </ol>
        <div className="tot">
          <span>Walking and transit</span>
          <span className="t">{formatSeconds(hud.walkingSeconds)}</span>
          <b>Cycle total</b>
          <b className="t">{formatSeconds(hud.cycleSeconds)}</b>
        </div>
      </details>
    </section>
  )
}
