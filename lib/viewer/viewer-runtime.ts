import {
  Color,
  PCFSoftShadowMap,
  PerspectiveCamera,
  type Texture,
  WebGLRenderer,
} from "three"
import { ASSEMBLY_JOB_STEPS } from "lib/job/assembly-job-steps"
import { getStationStandPose } from "lib/layout/get-station-stand-pose"
import { type TableId, TABLE_PLACEMENTS } from "lib/layout/station-layout"
import { getPinchWorldPosition } from "lib/operator/hand-pose"
import { ManufacturingSimulation } from "lib/simulation/manufacturing-simulation"
import type { ScenarioId } from "lib/simulation/scenarios"
import type { CameraHint, SimulationMode } from "lib/simulation/sim-context"
import { addSceneLighting } from "lib/viewer/add-scene-lighting"
import { type CameraMode, CameraRig } from "lib/viewer/camera-rig"
import { createFloorTexture } from "lib/viewer/create-floor-texture"
import { createLabelSprite } from "lib/viewer/create-label-sprite"
import type { HudSnapshot } from "lib/viewer/hud-snapshot"
import { createStationRing } from "lib/viewer/station-ring"
import type { ManufacturingWorld } from "lib/world/create-world"

const MAX_FRAME_SECONDS = 0.05
const HUD_INTERVAL_MS = 100
const ZOOM_PER_WHEEL_PX = 0.0012
const LABEL_HEIGHT_M = 1.62

interface PointerTrack {
  xPx: number
  yPx: number
  button: number
}

function readThemeToken(params: {
  style: CSSStyleDeclaration
  tokenName: string
  fallbackColor: string
}): string {
  return (
    params.style.getPropertyValue(params.tokenName).trim() ||
    params.fallbackColor
  )
}

/**
 * Owns the WebGL renderer, the simulation clock and all input for one viewer.
 * The React component creates one on mount and disposes it on unmount.
 */
export class ViewerRuntime {
  readonly simulation = new ManufacturingSimulation()
  private readonly renderer: WebGLRenderer
  private readonly camera = new PerspectiveCamera(42, 1, 0.02, 80)
  private readonly cameraRig = new CameraRig(this.camera)
  private readonly stationRing = createStationRing()
  private readonly keysDown = new Set<string>()
  private readonly pointers = new Map<number, PointerTrack>()
  private stickInput = { forward: 0, right: 0 }
  private pinchDistancePx = 0
  private isPaused = false
  private speed = 1
  private isAutoCloseUp = true
  private decoratedWorld: ManufacturingWorld | null = null
  private previousCameraHint: CameraHint | null = null
  private didAutoCloseUp = false
  private closeUpStationKey: string | null = null
  private floorTexture: Texture | null = null
  private animationFrameId = 0
  private previousFrameMs = 0
  private previousHudMs = 0
  private readonly darkModeQuery = window.matchMedia(
    "(prefers-color-scheme: dark)",
  )

  constructor(
    private readonly options: {
      canvas: HTMLCanvasElement
      themeElement: HTMLElement
      onHudChange: (hud: HudSnapshot) => void
    },
  ) {
    const { canvas } = options
    this.renderer = new WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    const { scene } = this.simulation.ctx
    addSceneLighting(scene)
    scene.add(this.stationRing)
    this.applyTheme()
    this.darkModeQuery.addEventListener("change", this.applyTheme)
    canvas.addEventListener("pointerdown", this.handlePointerDown)
    canvas.addEventListener("pointermove", this.handlePointerMove)
    canvas.addEventListener("pointerup", this.handlePointerUp)
    canvas.addEventListener("pointercancel", this.handlePointerUp)
    canvas.addEventListener("contextmenu", this.preventDefault)
    canvas.addEventListener("wheel", this.handleWheel, { passive: false })
    window.addEventListener("keydown", this.handleKeyDown)
    window.addEventListener("keyup", this.handleKeyUp)
    window.addEventListener("blur", this.clearKeys)
    this.simulation.startScenario("walk_floor")
    this.animationFrameId = requestAnimationFrame(this.renderFrame)
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrameId)
    const { canvas } = this.options
    this.darkModeQuery.removeEventListener("change", this.applyTheme)
    canvas.removeEventListener("pointerdown", this.handlePointerDown)
    canvas.removeEventListener("pointermove", this.handlePointerMove)
    canvas.removeEventListener("pointerup", this.handlePointerUp)
    canvas.removeEventListener("pointercancel", this.handlePointerUp)
    canvas.removeEventListener("contextmenu", this.preventDefault)
    canvas.removeEventListener("wheel", this.handleWheel)
    window.removeEventListener("keydown", this.handleKeyDown)
    window.removeEventListener("keyup", this.handleKeyUp)
    window.removeEventListener("blur", this.clearKeys)
    this.floorTexture?.dispose()
    this.renderer.dispose()
  }

  startScenario(scenarioId: ScenarioId): void {
    this.setMode("simulation")
    this.simulation.startScenario(scenarioId)
    if (scenarioId !== "assemble_and_pack") this.setCameraMode("follow")
    this.emitHud()
  }

  setMode(mode: SimulationMode): void {
    this.simulation.setMode(mode)
    if (mode === "game") {
      if (this.cameraRig.mode === "overview") this.setCameraMode("follow")
      this.options.canvas.focus()
    }
    this.emitHud()
  }

  reset(): void {
    this.simulation.reset()
    this.closeUpStationKey = null
    this.setCameraMode("follow")
    if (this.simulation.ctx.mode === "simulation")
      this.simulation.startScenario("walk_floor")
    else this.simulation.setMode("game")
    this.emitHud()
  }

  togglePause(): void {
    this.isPaused = !this.isPaused
    this.emitHud()
  }

  setSpeed(speed: number): void {
    this.speed = speed
    this.emitHud()
  }

  setCameraMode(mode: CameraMode): void {
    this.cameraRig.setMode({
      mode,
      isLandscape: window.innerWidth > window.innerHeight,
    })
    if (mode !== "close_up") this.cameraRig.closeUpFocus = null
    this.emitHud()
  }

  setAutoCloseUp(isAutoCloseUp: boolean): void {
    this.isAutoCloseUp = isAutoCloseUp
    this.emitHud()
  }

  runGameAction(actionKind: "step" | "screwdriver"): void {
    this.simulation.runGameAction(actionKind)
    this.emitHud()
  }

  /** Touch-stick input, -1..1 on each axis. */
  setStickInput(stickInput: { forward: number; right: number }): void {
    this.stickInput = stickInput
  }

  private readonly renderFrame = (nowMs: number): void => {
    this.animationFrameId = requestAnimationFrame(this.renderFrame)
    const realSeconds = this.previousFrameMs
      ? Math.min(MAX_FRAME_SECONDS, (nowMs - this.previousFrameMs) / 1000)
      : 0
    this.previousFrameMs = nowMs
    this.resizeToCanvas()
    this.decorateWorld()
    this.updateWalkInput()
    if (!this.isPaused) {
      const substepCount = Math.max(1, Math.ceil(this.speed))
      for (let substep = 0; substep < substepCount; substep++) {
        this.simulation.step((realSeconds * this.speed) / substepCount)
      }
    }
    this.syncCameraHint()
    const { operator } = this.simulation.ctx
    this.cameraRig.update({
      dtSeconds: realSeconds,
      operatorPosition: operator.position,
      fallbackCloseUpTarget: getPinchWorldPosition(operator.rightHand),
    })
    this.updateStationRing(nowMs)
    if (nowMs - this.previousHudMs > HUD_INTERVAL_MS) this.emitHud()
    this.renderer.render(this.simulation.ctx.scene, this.camera)
  }

  private resizeToCanvas(): void {
    const { canvas } = this.options
    const pixelRatio = this.renderer.getPixelRatio()
    const widthPx = canvas.clientWidth
    const heightPx = canvas.clientHeight
    if (
      canvas.width === Math.round(widthPx * pixelRatio) &&
      canvas.height === Math.round(heightPx * pixelRatio)
    )
      return
    this.renderer.setSize(widthPx, heightPx, false)
    this.camera.aspect = widthPx / Math.max(1, heightPx)
    this.camera.updateProjectionMatrix()
  }

  /** Add station labels whenever the simulation rebuilds its world. */
  private decorateWorld(): void {
    const { world } = this.simulation.ctx
    if (world === this.decoratedWorld) return
    this.decoratedWorld = world
    for (const tableId of Object.keys(world.tables) as TableId[]) {
      const label = createLabelSprite({
        text: TABLE_PLACEMENTS[tableId].label,
        widthM: 0.62,
      })
      label.position.set(0, LABEL_HEIGHT_M, -0.3)
      world.tables[tableId].add(label)
    }
  }

  private updateWalkInput(): void {
    const keys = this.keysDown
    const keyRight =
      (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
      (keys.has("a") || keys.has("arrowleft") ? 1 : 0)
    const keyForward =
      (keys.has("w") || keys.has("arrowup") ? 1 : 0) -
      (keys.has("s") || keys.has("arrowdown") ? 1 : 0)
    this.simulation.setWalkInput({
      forward: keyForward + this.stickInput.forward,
      right: keyRight + this.stickInput.right,
      cameraCcwYawRadians: this.cameraRig.ccwYawRadians,
    })
  }

  /** Move to a close-up when a task starts fine work, and back out when the work moves on. */
  private syncCameraHint(): void {
    const { ctx } = this.simulation
    const hint = ctx.cameraHint
    if (hint === this.previousCameraHint) return
    const previousHint = this.previousCameraHint
    this.previousCameraHint = hint
    if (hint) {
      this.cameraRig.closeUpFocus = hint.getFocusPoint
      if (!this.isAutoCloseUp) return
      this.cameraRig.modeDistancesM.close_up = hint.view.distanceM
      const stationKey = `${hint.station.tableId}:${hint.view.azimuthRadians}`
      if (this.closeUpStationKey !== stationKey) {
        this.closeUpStationKey = stationKey
        this.cameraRig.ccwYawRadians =
          getStationStandPose(hint.station).ccwYawRadians +
          Math.PI +
          hint.view.azimuthRadians
        this.cameraRig.pitchRadians = hint.view.elevationRadians
      }
      this.cameraRig.setMode({
        mode: "close_up",
        isLandscape: window.innerWidth > window.innerHeight,
      })
      this.didAutoCloseUp = true
      return
    }
    if (
      !this.didAutoCloseUp ||
      !this.isAutoCloseUp ||
      this.cameraRig.mode !== "close_up"
    )
      return
    this.didAutoCloseUp = false
    const nextStep = ASSEMBLY_JOB_STEPS[ctx.progress.completedStepCount]
    const isStayingAtStation =
      nextStep &&
      previousHint &&
      ctx.mode === "simulation" &&
      !ctx.progress.isHoldingLooseScrewdriver &&
      nextStep.station.tableId === previousHint.station.tableId
    if (!isStayingAtStation) {
      this.closeUpStationKey = null
      this.setCameraMode("follow")
    }
  }

  private updateStationRing(nowMs: number): void {
    const { progress, mode } = this.simulation.ctx
    const nextStep = ASSEMBLY_JOB_STEPS[progress.completedStepCount]
    const isVisible =
      nextStep &&
      !progress.isOperatorBusy &&
      !progress.isHoldingLooseScrewdriver &&
      (mode === "game" || progress.isJobActive)
    this.stationRing.visible = Boolean(isVisible)
    if (!nextStep || !isVisible) return
    const pose = getStationStandPose(nextStep.station)
    this.stationRing.position.set(pose.x, 0.012, pose.z)
    this.stationRing.material.opacity = 0.55 + 0.3 * Math.sin(nowMs * 0.005)
  }

  private emitHud(): void {
    this.previousHudMs = performance.now()
    const { ctx } = this.simulation
    const { progress } = ctx
    const actions = this.simulation.getGameActions()
    const steps = ASSEMBLY_JOB_STEPS.map((step, index) => ({
      label: step.label,
      seconds: progress.stepSeconds[index],
      state:
        index === progress.activeStepIndex
          ? ("active" as const)
          : index < progress.completedStepCount
            ? ("done" as const)
            : ("pending" as const),
    }))
    const stepSeconds = progress.stepSeconds.reduce(
      (sum, seconds) => sum + seconds,
      0,
    )
    let statusText = ctx.statusText
    const nextStep = ASSEMBLY_JOB_STEPS[progress.completedStepCount]
    const hasPrompt = actions.stepAction || actions.screwdriverAction
    if (
      ctx.mode === "game" &&
      !this.simulation.isTaskRunning &&
      !hasPrompt &&
      nextStep &&
      !progress.isHoldingLooseScrewdriver
    ) {
      const tableLabel =
        TABLE_PLACEMENTS[nextStep.station.tableId].label.toLowerCase()
      statusText = `Next: ${nextStep.label.toLowerCase()} at the ${tableLabel}`
    }
    this.options.onHudChange({
      mode: ctx.mode,
      statusText,
      isPaused: this.isPaused,
      speed: this.speed,
      cameraMode: this.cameraRig.mode,
      isAutoCloseUp: this.isAutoCloseUp,
      steps,
      walkingSeconds: Math.max(0, progress.cycleSeconds - stepSeconds),
      cycleSeconds: progress.cycleSeconds,
      stepPromptLabel: actions.stepAction?.label ?? null,
      screwdriverPromptLabel: actions.screwdriverAction?.label ?? null,
    })
  }

  private readonly applyTheme = (): void => {
    const style = getComputedStyle(this.options.themeElement)
    const { scene } = this.simulation.ctx
    const { roomShell } = this.simulation
    scene.background = new Color(
      readThemeToken({
        style,
        tokenName: "--scene-bg",
        fallbackColor: "#dfe5ea",
      }),
    )
    this.floorTexture?.dispose()
    this.floorTexture = createFloorTexture({
      tileColor: readThemeToken({
        style,
        tokenName: "--floor",
        fallbackColor: "#c9cfd4",
      }),
      groutColor: readThemeToken({
        style,
        tokenName: "--floor-line",
        fallbackColor: "#b4bcc3",
      }),
    })
    roomShell.floorMaterial.map = this.floorTexture
    roomShell.floorMaterial.color.set(0xffffff)
    roomShell.floorMaterial.needsUpdate = true
    roomShell.wallMaterial.color.set(
      readThemeToken({ style, tokenName: "--wall", fallbackColor: "#f2f4f5" }),
    )
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const targetTag = (event.target as HTMLElement | null)?.tagName
    if (targetTag === "SELECT" || targetTag === "INPUT") return
    const key = event.key.toLowerCase()
    this.keysDown.add(key)
    const { mode } = this.simulation.ctx
    if (key === "g") this.setMode(mode === "game" ? "simulation" : "game")
    if (mode === "game") {
      if (key === "e") this.runGameAction("step")
      if (key === "f") this.runGameAction("screwdriver")
      if (key.startsWith("arrow") || key === " ") event.preventDefault()
    }
    if (key === "1") this.setCameraMode("overview")
    if (key === "2") this.setCameraMode("follow")
    if (key === "3") this.setCameraMode("close_up")
  }

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keysDown.delete(event.key.toLowerCase())
  }

  private readonly clearKeys = (): void => {
    this.keysDown.clear()
  }

  private readonly preventDefault = (event: Event): void => {
    event.preventDefault()
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.options.canvas.setPointerCapture(event.pointerId)
    this.pointers.set(event.pointerId, {
      xPx: event.clientX,
      yPx: event.clientY,
      button: event.button,
    })
    this.options.canvas.focus()
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const pointer = this.pointers.get(event.pointerId)
    if (!pointer) return
    const dxPx = event.clientX - pointer.xPx
    const dyPx = event.clientY - pointer.yPx
    pointer.xPx = event.clientX
    pointer.yPx = event.clientY
    if (this.pointers.size === 2) {
      const [first, second] = [...this.pointers.values()]
      const distancePx = Math.hypot(
        first.xPx - second.xPx,
        first.yPx - second.yPx,
      )
      if (this.pinchDistancePx)
        this.cameraRig.zoom(this.pinchDistancePx / distancePx)
      this.pinchDistancePx = distancePx
      return
    }
    if (pointer.button === 2 || event.shiftKey)
      this.cameraRig.pan({ dxPx, dyPx })
    else this.cameraRig.orbit({ dxPx, dyPx })
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId)
    this.pinchDistancePx = 0
  }

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault()
    this.cameraRig.zoom(Math.exp(event.deltaY * ZOOM_PER_WHEEL_PX))
  }
}
