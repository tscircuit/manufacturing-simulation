import { formatSeconds } from "lib/job/bench-work"
import type { UnitStage } from "lib/world/create-world"
import type { Ref } from "react"

const STAGE_LABELS: Record<UnitStage, string> = {
  raw: "To assemble",
  assembled: "Assembled",
  tested: "Tested",
  packed: "Boxed",
  in_carton: "In carton",
  shipped: "Shipped",
}

import type { HudSnapshot } from "lib/viewer/hud-snapshot"

export function CycleTimingPanel(props: {
  detailsRef: Ref<HTMLDetailsElement>
  hud: HudSnapshot
  onToggle?: () => void
}) {
  const { hud } = props
  return (
    <section className="panel timing">
      <details open ref={props.detailsRef} onToggle={props.onToggle}>
        <summary>
          <span>Batch timing</span>
          <span className="t">{formatSeconds(hud.cycleSeconds)}</span>
        </summary>
        <ol className="rows">
          {hud.steps.map((step, index) => (
            <li key={step.label} className={step.state}>
              <span className="num">
                {step.state === "done" ? "✓" : index + 1}
              </span>
              <span>
                {step.label}
                {step.runCount !== null && step.runCount > 1 && (
                  <span className="count">
                    {" "}
                    {step.completedCount}/{step.runCount}
                  </span>
                )}
                {step.runCount === null && step.completedCount > 0 && (
                  <span className="count"> ×{step.completedCount}</span>
                )}
              </span>
              <span className="t">
                {step.seconds > 0 ? formatSeconds(step.seconds) : "–"}
              </span>
            </li>
          ))}
        </ol>
        <div className="tot">
          <div className="stages">
            {hud.unitsByStage.map(({ stage, count }) => (
              <span key={stage} className="stage-cell">
                {STAGE_LABELS[stage]} <b>{count}</b>
              </span>
            ))}
          </div>
          <span>Labels at pack-out</span>
          <span className="t">
            {hud.labelsAtPackOut}
            {hud.printedLabelSheets > 0 &&
              ` +${hud.printedLabelSheets} sheets printed`}
          </span>
          <span>Spacers in basket</span>
          <span className="t">{hud.spacersInBasket}</span>
          {hud.printerLines.map((line) => (
            <span key={line} className="printer-line">
              {line}
            </span>
          ))}
          <span>Walking and transit</span>
          <span className="t">{formatSeconds(hud.walkingSeconds)}</span>
          <b>Cycle total</b>
          <b className="t">{formatSeconds(hud.cycleSeconds)}</b>
        </div>
      </details>
    </section>
  )
}
