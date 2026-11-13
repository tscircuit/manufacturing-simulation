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

/**
 * Full-size 3D view of the unit 322 floor with the operator, the three
 * stations, per-step cycle timing and a playable game mode.
 */
export function ManufacturingSimulationViewer() {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controlDetailsRef = useRef<HTMLDetailsElement>(null)
  const timingDetailsRef = useRef<HTMLDetailsElement>(null)
  const runtimeRef = useRef<ViewerRuntime | null>(null)
  const [hud, setHud] = useState<HudSnapshot | null>(null)
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return
    const runtime = new ViewerRuntime({
      canvas,
      themeElement: root,
      onHudChange: setHud,
    })
    runtimeRef.current = runtime
    setIsCoarsePointer(window.matchMedia("(pointer: coarse)").matches)
    if (window.innerWidth < NARROW_SCREEN_PX) {
      if (controlDetailsRef.current) controlDetailsRef.current.open = false
      if (timingDetailsRef.current) timingDetailsRef.current.open = false
    }
    return () => {
      runtime.dispose()
      runtimeRef.current = null
    }
  }, [])

  return (
    <div className="msim" ref={rootRef}>
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
          />
          <CycleTimingPanel detailsRef={timingDetailsRef} hud={hud} />
          {hud.mode === "game" && isCoarsePointer && (
            <TouchControls
              onStickChange={(stickInput) =>
                runtimeRef.current?.setStickInput(stickInput)
              }
              onAct={() =>
                runtimeRef.current?.runGameAction(
                  hud.benchPromptLabel ? "bench" : "screwdriver",
                )
              }
              onCarry={
                hud.carryPromptLabel
                  ? () => runtimeRef.current?.runGameAction("carry")
                  : null
              }
            />
          )}
          <div className="bottom">
            <StatusBar hud={hud} />
            <CameraBar
              cameraMode={hud.cameraMode}
              isAutoCloseUp={hud.isAutoCloseUp}
              onCameraModeChange={(mode) =>
                runtimeRef.current?.setCameraMode(mode)
              }
              onAutoCloseUpChange={(isAutoCloseUp) =>
                runtimeRef.current?.setAutoCloseUp(isAutoCloseUp)
              }
            />
          </div>
        </>
      )}
    </div>
  )
}
