import type { GameActionKind } from "lib/simulation/manufacturing-simulation"
import { getPromptActions } from "lib/viewer/hud/status-bar"
import type { HudSnapshot } from "lib/viewer/hud-snapshot"
import { type PointerEvent, useRef, useState } from "react"

const STICK_RADIUS_PX = 56
const STICK_TRAVEL_PX = 42
const KNOB_TRAVEL_PX = 34
const MENU_MESSAGE_SECONDS = 2.5

/** Where the thumb went down, in the touch zone's coordinates: the stick's centre. */
interface StickOrigin {
  xPx: number
  yPx: number
}

/** Stick deflection -1..1 on each axis (+y is down on screen) from where the thumb first touched. */
function getStickDeflection(params: {
  event: PointerEvent<HTMLDivElement>
  origin: StickOrigin
}): { x: number; y: number } {
  const bounds = params.event.currentTarget.getBoundingClientRect()
  const x =
    (params.event.clientX - bounds.left - params.origin.xPx) / STICK_TRAVEL_PX
  const y =
    (params.event.clientY - bounds.top - params.origin.yPx) / STICK_TRAVEL_PX
  const length = Math.max(1, Math.hypot(x, y))
  return { x: x / length, y: y / length }
}

const CAMERA_CYCLE_LABELS = {
  overview: "Room",
  follow: "Follow",
  close_up: "Close",
} as const

/**
 * Phone and tablet controls. In game mode, touching the left half of the
 * screen brings up a walk stick under the thumb (gone when the thumb lifts);
 * the right half stays free to drag the camera. Bottom-right: a big E button,
 * R, C and F beside it when they apply, and a camera button.
 */
export function TouchControls(props: {
  hud: HudSnapshot
  /** A panel is open over the view: the walk stick waits until it's closed. */
  isMenuOpen: boolean
  onStickChange: (stickInput: { forward: number; right: number }) => void
  onAction: (kind: GameActionKind) => void
  onCycleCamera: () => void
}) {
  const { hud } = props
  const activePointerId = useRef<number | null>(null)
  const [origin, setOrigin] = useState<StickOrigin | null>(null)
  const [knobOffset, setKnobOffset] = useState({ xPx: 0, yPx: 0 })
  const [isMenuMessageShown, setIsMenuMessageShown] = useState(false)
  const menuMessageTimer = useRef<number | undefined>(undefined)

  const applyDeflection = (deflection: { x: number; y: number }) => {
    setKnobOffset({
      xPx: deflection.x * KNOB_TRAVEL_PX,
      yPx: deflection.y * KNOB_TRAVEL_PX,
    })
    props.onStickChange({ forward: -deflection.y, right: deflection.x })
  }
  const releaseStick = () => {
    activePointerId.current = null
    setOrigin(null)
    applyDeflection({ x: 0, y: 0 })
  }
  const showMenuMessage = () => {
    setIsMenuMessageShown(true)
    window.clearTimeout(menuMessageTimer.current)
    menuMessageTimer.current = window.setTimeout(
      () => setIsMenuMessageShown(false),
      MENU_MESSAGE_SECONDS * 1000,
    )
  }
  const isGame = hud.mode === "game"
  const prompts = isGame ? getPromptActions(hud) : []
  const benchPrompt = prompts.find((prompt) => prompt.kind === "bench")
  const sidePrompts = prompts.filter((prompt) => prompt.kind !== "bench")

  return (
    <>
      {isGame && (
        // Left half of the screen: a thumb anywhere here brings up the stick under it; lifting it hides the stick.
        <div
          className="stick-zone"
          aria-label="Touch and drag here to walk"
          onPointerDown={(event) => {
            if (activePointerId.current !== null) return
            if (props.isMenuOpen) {
              showMenuMessage()
              return
            }
            const bounds = event.currentTarget.getBoundingClientRect()
            const touchOrigin = {
              xPx: event.clientX - bounds.left,
              yPx: event.clientY - bounds.top,
            }
            activePointerId.current = event.pointerId
            event.currentTarget.setPointerCapture(event.pointerId)
            setOrigin(touchOrigin)
            applyDeflection({ x: 0, y: 0 })
          }}
          onPointerMove={(event) => {
            if (event.pointerId !== activePointerId.current || !origin) return
            applyDeflection(getStickDeflection({ event, origin }))
          }}
          onPointerUp={(event) => {
            if (event.pointerId === activePointerId.current) releaseStick()
          }}
          onPointerCancel={(event) => {
            if (event.pointerId === activePointerId.current) releaseStick()
          }}
        >
          {origin && (
            <div
              className="stick"
              style={{
                left: origin.xPx - STICK_RADIUS_PX,
                top: origin.yPx - STICK_RADIUS_PX,
              }}
            >
              <div
                className="knob"
                style={{
                  transform: `translate(${knobOffset.xPx}px, ${knobOffset.yPx}px)`,
                }}
              />
            </div>
          )}
          {!origin && !props.isMenuOpen && (
            <div className="stick-hint">Touch here to walk</div>
          )}
        </div>
      )}
      {isMenuMessageShown && (
        <div className="touch-message" role="status">
          Close the menu to walk
        </div>
      )}
      <div className="touch-actions">
        <button
          type="button"
          className="touch-button small"
          aria-label="Change camera view"
          onClick={props.onCycleCamera}
        >
          {CAMERA_CYCLE_LABELS[hud.cameraMode]}
        </button>
        {sidePrompts.map((prompt) => (
          <button
            key={prompt.key}
            type="button"
            className="touch-button small"
            aria-label={prompt.label}
            onClick={() => props.onAction(prompt.kind)}
          >
            {prompt.key}
          </button>
        ))}
        {isGame && (
          <button
            type="button"
            className="touch-button main"
            disabled={!benchPrompt}
            aria-label={benchPrompt?.label ?? "Nothing to do here"}
            onClick={() => props.onAction("bench")}
          >
            E
          </button>
        )}
      </div>
    </>
  )
}
