import type { ProductLine } from "lib/job/job-plan"
import type { CameraMode } from "lib/viewer/camera-rig"
import { CameraBar } from "lib/viewer/hud/camera-bar"
import { ControlPanel } from "lib/viewer/hud/control-panel"
import { CycleTimingPanel } from "lib/viewer/hud/cycle-timing-panel"
import { StatusBar } from "lib/viewer/hud/status-bar"
import { TouchControls } from "lib/viewer/hud/touch-controls"
import type { HudSnapshot } from "lib/viewer/hud-snapshot"
import { ViewerRuntime } from "lib/viewer/viewer-runtime"
import { VIEWER_STYLES } from "lib/viewer/viewer-styles"
import { useEffect, useRef, useState } from "react"

const NARROW_SCREEN_PX = 720
const SHORT_SCREEN_PX = 500
const CAMERA_CYCLE: CameraMode[] = ["follow", "close_up", "overview"]

/**
 * Full-size 3D view of the unit 322 floor with the operator, the three
 * stations, per-step cycle timing and a playable game mode.
 */
export function ManufacturingSimulationViewer(
  props: {
    /** "kit" (default): the boxed full kit. "bagged": the bare unit in an ESD bag. */
    productLine?: ProductLine
  } = {},
) {
  const productLine = props.productLine ?? "kit"
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controlDetailsRef = useRef<HTMLDetailsElement>(null)
  const timingDetailsRef = useRef<HTMLDetailsElement>(null)
  const runtimeRef = useRef<ViewerRuntime | null>(null)
  const [hud, setHud] = useState<HudSnapshot | null>(null)
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)
  const [isPortrait, setIsPortrait] = useState(false)
  const [isRotateTipDismissed, setIsRotateTipDismissed] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const hasHud = hud !== null

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return
    const runtime = new ViewerRuntime({
      canvas,
      themeElement: root,
      onHudChange: setHud,
      productLine,
    })
    runtimeRef.current = runtime
    setIsCoarsePointer(window.matchMedia("(pointer: coarse)").matches)
    const portraitQuery = window.matchMedia("(orientation: portrait)")
    const updateOrientation = () => setIsPortrait(portraitQuery.matches)
    updateOrientation()
    portraitQuery.addEventListener("change", updateOrientation)
    return () => {
      portraitQuery.removeEventListener("change", updateOrientation)
      runtime.dispose()
      runtimeRef.current = null
    }
  }, [productLine])

  // On phones and small windows, start with both panels folded so the floor is visible.
  useEffect(() => {
    if (!hasHud) return
    const isSmall =
      window.innerWidth < NARROW_SCREEN_PX ||
      window.innerHeight < SHORT_SCREEN_PX ||
      window.matchMedia("(pointer: coarse)").matches
    if (!isSmall) return
    if (controlDetailsRef.current) controlDetailsRef.current.open = false
    if (timingDetailsRef.current) timingDetailsRef.current.open = false
    setIsMenuOpen(false)
  }, [hasHud])

  /** On touch screens only one panel opens at a time, as a sheet over the view. */
  const foldOtherPanel = (opened: HTMLDetailsElement | null) => {
    const panels = [controlDetailsRef.current, timingDetailsRef.current]
    if (isCoarsePointer && opened?.open)
      for (const panel of panels)
        if (panel && panel !== opened) panel.open = false
    setIsMenuOpen(panels.some((panel) => panel?.open))
  }
  const cycleCamera = () => {
    if (!hud) return
    const next =
      CAMERA_CYCLE[
        (CAMERA_CYCLE.indexOf(hud.cameraMode) + 1) % CAMERA_CYCLE.length
      ]
    runtimeRef.current?.setCameraMode(next)
  }
  const cameraBar = hud && (
    <CameraBar
      cameraMode={hud.cameraMode}
      isAutoCloseUp={hud.isAutoCloseUp}
      isSoundOn={hud.isSoundOn}
      onSoundChange={(isSoundOn) => runtimeRef.current?.setSoundOn(isSoundOn)}
      onCameraModeChange={(mode) => runtimeRef.current?.setCameraMode(mode)}
      onAutoCloseUpChange={(isAutoCloseUp) =>
        runtimeRef.current?.setAutoCloseUp(isAutoCloseUp)
      }
    />
  )

  return (
    <div className={isCoarsePointer ? "msim touch" : "msim"} ref={rootRef}>
      <style>{VIEWER_STYLES}</style>
      <canvas
        ref={canvasRef}
        className="msim-canvas"
        tabIndex={0}
        aria-label="3D view of the unit 322 floor with the operator and work stations"
      />
      {hud && (
        <>
          <ControlPanel
            detailsRef={controlDetailsRef}
            mode={hud.mode}
            productLine={hud.productLine}
            jobUnitCount={hud.jobUnitCount}
            onJobUnitCountChange={(unitCount) =>
              runtimeRef.current?.setJobUnitCount(unitCount)
            }
            isPaused={hud.isPaused}
            speed={hud.speed}
            onModeChange={(mode) => runtimeRef.current?.setMode(mode)}
            onScenarioStart={(scenarioId) =>
              runtimeRef.current?.startScenario(scenarioId)
            }
            onPauseToggle={() => runtimeRef.current?.togglePause()}
            onSpeedChange={(speed) => runtimeRef.current?.setSpeed(speed)}
            onReset={() => runtimeRef.current?.reset()}
            onStartAt={(startId) => runtimeRef.current?.startAt(startId)}
            onPrintsReady={() => runtimeRef.current?.finishPrintsNow()}
            onLabelsPrinted={() => runtimeRef.current?.printLabelsNow()}
            onToggle={() => foldOtherPanel(controlDetailsRef.current)}
          >
            {isCoarsePointer && cameraBar}
          </ControlPanel>
          <CycleTimingPanel
            detailsRef={timingDetailsRef}
            hud={hud}
            onToggle={() => foldOtherPanel(timingDetailsRef.current)}
          />
          {isCoarsePointer && (
            <TouchControls
              hud={hud}
              isMenuOpen={isMenuOpen}
              onStickChange={(stickInput) =>
                runtimeRef.current?.setStickInput(stickInput)
              }
              onAction={(kind) => runtimeRef.current?.runGameAction(kind)}
              onCycleCamera={cycleCamera}
            />
          )}
          {isCoarsePointer && isPortrait && !isRotateTipDismissed && (
            <button
              type="button"
              className="rotate-tip"
              onClick={() => setIsRotateTipDismissed(true)}
            >
              ⟳ Turn your phone sideways for the best view
              <span aria-hidden="true"> ✕</span>
            </button>
          )}
          <div className="bottom">
            <StatusBar
              hud={hud}
              isTouch={isCoarsePointer}
              onAction={(kind) => runtimeRef.current?.runGameAction(kind)}
            />
            {!isCoarsePointer && cameraBar}
          </div>
        </>
      )}
    </div>
  )
}
