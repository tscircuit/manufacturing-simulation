import { type PointerEvent, useRef, useState } from "react"

const STICK_RADIUS_PX = 52
const STICK_TRAVEL_PX = 40
const KNOB_TRAVEL_PX = 32

/** Stick deflection -1..1 on each axis (+y is down on screen) for a pointer over the stick. */
function getStickDeflection(event: PointerEvent<HTMLDivElement>): {
  x: number
  y: number
} {
  const bounds = event.currentTarget.getBoundingClientRect()
  const x = (event.clientX - bounds.left - STICK_RADIUS_PX) / STICK_TRAVEL_PX
  const y = (event.clientY - bounds.top - STICK_RADIUS_PX) / STICK_TRAVEL_PX
  const length = Math.max(1, Math.hypot(x, y))
  return { x: x / length, y: y / length }
}

/** On-screen stick and Act button for game mode on touch screens. */
export function TouchControls(props: {
  onStickChange: (stickInput: { forward: number; right: number }) => void
  onAct: () => void
  benchLabel: string | null
  onRunBench: () => void
}) {
  const activePointerId = useRef<number | null>(null)
  const [knobOffset, setKnobOffset] = useState({ xPx: 0, yPx: 0 })

  const applyDeflection = (deflection: { x: number; y: number }) => {
    setKnobOffset({
      xPx: deflection.x * KNOB_TRAVEL_PX,
      yPx: deflection.y * KNOB_TRAVEL_PX,
    })
    props.onStickChange({ forward: -deflection.y, right: deflection.x })
  }

  return (
    <>
      <div
        className="stick"
        onPointerDown={(event) => {
          activePointerId.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          applyDeflection(getStickDeflection(event))
        }}
        onPointerMove={(event) => {
          if (event.pointerId === activePointerId.current)
            applyDeflection(getStickDeflection(event))
        }}
        onPointerUp={() => {
          activePointerId.current = null
          applyDeflection({ x: 0, y: 0 })
        }}
        onPointerCancel={() => {
          activePointerId.current = null
          applyDeflection({ x: 0, y: 0 })
        }}
      >
        <div
          className="knob"
          style={{
            transform: `translate(${knobOffset.xPx}px, ${knobOffset.yPx}px)`,
          }}
        />
      </div>
      <button type="button" className="act" onClick={props.onAct}>
        Act
      </button>
      {props.benchLabel && (
        <button
          type="button"
          className="act run-bench"
          onClick={props.onRunBench}
        >
          {props.benchLabel}
        </button>
      )}
    </>
  )
}
