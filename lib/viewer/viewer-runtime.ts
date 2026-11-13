import { countUnitsByStage, getNextLineWork } from "lib/job/bench-work"
import { JOB_ROWS } from "lib/job/job-plan"
import { countLabelsAtPackOut } from "lib/job/label-stock"
import { getStationStandPose } from "lib/layout/get-station-stand-pose"
import { TABLE_PLACEMENTS, type TableId } from "lib/layout/station-layout"
import { BAMBU_PRINTERS, type BambuPrinter } from "lib/models/bambu-printer"
import type { QcDisplayState } from "lib/models/qc-laptop"
import { getPinchWorldPosition } from "lib/operator/hand-pose"
import type { LineStartId } from "lib/simulation/line-setup"
import {
  type GameActionKind,
  ManufacturingSimulation,
} from "lib/simulation/manufacturing-simulation"
import type { ScenarioId } from "lib/simulation/scenarios"
import type { CameraHint, SimulationMode } from "lib/simulation/sim-context"
import { addSceneLighting } from "lib/viewer/add-scene-lighting"
import { type CameraMode, CameraRig } from "lib/viewer/camera-rig"
import { createFloorTexture } from "lib/viewer/create-floor-texture"
import { createLabelSprite } from "lib/viewer/create-label-sprite"
import { createQcScreenTexture } from "lib/viewer/create-qc-screen-texture"
import type { HudSnapshot } from "lib/viewer/hud-snapshot"
import { NEMA17_LABEL_DATA_URL } from "lib/viewer/nema17-label-artwork"
import {
  getOperatorObstruction,
  updateMaterialOpacity,
} from "lib/viewer/operator-fade"
import { createStationRing } from "lib/viewer/station-ring"
import type { ManufacturingWorld } from "lib/world/create-world"
import {
  Color,
  Mesh,
  type MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  type Sprite,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  WebGLRenderer,
} from "three"

const MAX_FRAME_SECONDS = 0.05
const HUD_INTERVAL_MS = 100
const ZOOM_PER_WHEEL_PX = 0.0012
const LABEL_HEIGHT_M = 1.62

interface PointerTrack {
  xPx: number
  yPx: number
  button: number
}

declare global {
  interface Window {
    /** Set when the page is opened with `?inspect`. */
    manufacturingViewer?: ViewerRuntime
  }
}

/** Short status for a printer's sign and the HUD. */
function getPrinterStatusText(printer: BambuPrinter): string {
  if (!printer.isPrinting) {
    return printer.plateSpacers.length > 0
      ? `${printer.model}: ${printer.plateSpacers.length} spacers ready`
      : `${printer.model}: idle`
  }
  const totalSeconds = BAMBU_PRINTERS[printer.model].estimatedPlateSeconds
  const percent = Math.floor((100 * printer.printedSeconds) / totalSeconds)
  const remainingMinutes = Math.ceil(
    (totalSeconds - printer.printedSeconds) / 60,
  )
  const remaining =
    remainingMinutes >= 60
      ? `${Math.floor(remainingMinutes / 60)} h ${remainingMinutes % 60} m`
      : `${remainingMinutes} m`
  return `${printer.model}: printing ${percent}%, ${remaining} left`
}

function loadLabelTexture(): Texture {
  const texture = new TextureLoader().load(NEMA17_LABEL_DATA_URL)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
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
  /** The approved NEMA17 label artwork from tscircuit/product-packaging. */
  private readonly stickerTexture = loadLabelTexture()
  private readonly qcScreenTextures: Record<QcDisplayState, Texture> = {
    idle: createQcScreenTexture("idle"),
    testing: createQcScreenTexture("testing"),
    pass: createQcScreenTexture("pass"),
  }
  private shownQcDisplayState: QcDisplayState | null = null
  private texturedLabelSheetCount = -1
  private printerSigns: Array<{ text: string; sprite: Sprite }> = []
  private stationSigns: Sprite[] = []
  private operatorBodyOpacity = 1
  private operatorHandOpacity = 1
  private animationFrameId = 0
  private previousFrameMs = 0
  private previousHudMs = 0
  private readonly darkModeQuery = window.matchMedia(
    "(prefers-color-scheme: dark)",
  )
  private readonly themeAttributeObserver = new MutationObserver(() =>
    this.applyTheme(),
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
    this.themeAttributeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    })
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
    // `?inspect` exposes the runtime for debugging and automated checks.
    if (new URLSearchParams(window.location.search).has("inspect")) {
      window.manufacturingViewer = this
    }
    this.animationFrameId = requestAnimationFrame(this.renderFrame)
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrameId)
    const { canvas } = this.options
    this.darkModeQuery.removeEventListener("change", this.applyTheme)
    this.themeAttributeObserver.disconnect()
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
    this.stickerTexture.dispose()
    for (const texture of Object.values(this.qcScreenTextures))
      texture.dispose()
    this.renderer.dispose()
  }

  startScenario(scenarioId: ScenarioId): void {
    this.setMode("simulation")
    this.simulation.startScenario(scenarioId)
    if (scenarioId !== "run_batch" && scenarioId !== "refill_spacers")
      this.setCameraMode("follow")
    this.emitHud()
  }

  /** Start over with all 30 units ready for one bench. */
  startAt(startId: LineStartId): void {
    this.simulation.startAt(startId)
    this.closeUpStationKey = null
    this.setCameraMode("follow")
    this.emitHud()
  }

  /** Finish the running 3D prints now. */
  finishPrintsNow(): void {
    this.simulation.finishPrintsNow()
    this.emitHud()
  }

  /** Fill the label printer's tray now. */
  printLabelsNow(): void {
    this.simulation.printLabelsNow()
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

  runGameAction(actionKind: GameActionKind): void {
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
    const obstruction = getOperatorObstruction({
      operator,
      cameraPosition: this.camera.position,
      lookTarget: this.cameraRig.target,
      checkSightLine: this.cameraRig.mode === "close_up",
    })
    this.operatorBodyOpacity = updateMaterialOpacity({
      materials: operator.materials,
      currentOpacity: this.operatorBodyOpacity,
      isFaded: obstruction !== "none",
      dtSeconds: realSeconds,
    })
    this.operatorHandOpacity = updateMaterialOpacity({
      materials: operator.handMaterials,
      currentOpacity: this.operatorHandOpacity,
      isFaded: obstruction === "camera_inside",
      dtSeconds: realSeconds,
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

  /** Add station signs and printed artwork whenever the simulation rebuilds its world. */
  private decorateWorld(): void {
    const { world } = this.simulation.ctx
    if (world !== this.decoratedWorld) {
      this.decoratedWorld = world
      this.shownQcDisplayState = null
      this.texturedLabelSheetCount = -1
      this.printerSigns = []
      this.stationSigns = []
      for (const tableId of Object.keys(world.tables) as TableId[]) {
        const placement = TABLE_PLACEMENTS[tableId]
        const text =
          placement.lineOrder > 0
            ? `${placement.lineOrder} · ${placement.label}`
            : placement.label
        const label = createLabelSprite({ text, widthM: 0.72 })
        label.position.set(0, LABEL_HEIGHT_M, -0.3)
        world.tables[tableId].add(label)
        this.stationSigns.push(label)
      }
    }
    // Label sheets keep coming out of the label printer; give new ones the artwork.
    if (
      world.labelPrinter.printedSheets.length !== this.texturedLabelSheetCount
    ) {
      this.texturedLabelSheetCount = world.labelPrinter.printedSheets.length
      world.root.traverse((object) => {
        if (!(object instanceof Mesh) || !object.userData.isStickerFace) return
        const material = object.material as MeshStandardMaterial
        if (material.map === this.stickerTexture) return
        material.map = this.stickerTexture
        material.color.set(0xffffff)
        material.needsUpdate = true
      })
    }
    this.updatePrinterSigns(world)
    // Signs would sit in front of the work in a close-up.
    const showSigns = this.cameraRig.mode !== "close_up"
    for (const sign of this.stationSigns) sign.visible = showSigns
    for (const { sprite } of this.printerSigns) sprite.visible = showSigns
    const { laptop } = world
    if (laptop.displayState === this.shownQcDisplayState) return
    this.shownQcDisplayState = laptop.displayState
    laptop.display.material.map = this.qcScreenTextures[laptop.displayState]
    laptop.display.material.color.set(0xffffff)
    laptop.display.material.needsUpdate = true
  }

  /** A floating sign over each 3D printer with its plate status or print progress. */
  private updatePrinterSigns(world: ManufacturingWorld): void {
    for (const [index, printer] of world.printers.entries()) {
      const text = getPrinterStatusText(printer)
      const sign = this.printerSigns[index]
      if (sign?.text === text) continue
      if (sign) {
        sign.sprite.removeFromParent()
        sign.sprite.material.map?.dispose()
        sign.sprite.material.dispose()
      }
      const sprite = createLabelSprite({ text, widthM: 0.62 })
      sprite.position.set(0, BAMBU_PRINTERS[printer.model].heightM + 0.12, 0)
      printer.group.add(sprite)
      this.printerSigns[index] = { text, sprite }
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
    const nextStep = getNextLineWork(ctx)?.row.step
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
    const nextStep = getNextLineWork(this.simulation.ctx)?.row.step
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
    const { activeRowIndex } = progress
    const steps = JOB_ROWS.map((row) => {
      const completedCount = progress.rowCompletedCounts[row.rowIndex]
      return {
        label: row.step.label,
        seconds: progress.rowSeconds[row.rowIndex],
        completedCount,
        runCount: row.runCount,
        state:
          row.rowIndex === activeRowIndex
            ? ("active" as const)
            : row.runCount !== null && completedCount >= row.runCount
              ? ("done" as const)
              : ("pending" as const),
      }
    })
    const stepSeconds = progress.rowSeconds.reduce(
      (sum, seconds) => sum + seconds,
      0,
    )
    let statusText = ctx.statusText
    const nextItem = getNextLineWork(ctx)
    const hasPrompt =
      actions.benchAction || actions.carryAction || actions.screwdriverAction
    if (ctx.mode === "game" && actions.blockedReason)
      statusText = actions.blockedReason
    else if (
      ctx.mode === "game" &&
      !this.simulation.isTaskRunning &&
      !hasPrompt &&
      nextItem &&
      !ctx.world.carriedTub
    ) {
      const tableLabel =
        TABLE_PLACEMENTS[nextItem.row.step.station.tableId].label
      statusText = `Next: ${nextItem.row.step.label.toLowerCase()} at the ${tableLabel}`
    }
    if (this.simulation.isTaskPaused) statusText = `Paused: ${statusText}`
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
      benchPromptLabel:
        actions.pauseLabel ?? actions.benchAction?.label ?? null,
      carryPromptLabel: actions.carryAction?.label ?? null,
      screwdriverPromptLabel: actions.screwdriverAction?.label ?? null,
      unitsByStage: countUnitsByStage(ctx),
      labelsAtPackOut: countLabelsAtPackOut(ctx.world),
      printedLabelSheets: ctx.world.labelPrinter.printedSheets.length,
      spacersInBasket: ctx.world.spacerStock.length,
      printerLines: ctx.world.printers.map((printer) =>
        getPrinterStatusText(printer),
      ),
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
      if (key === "e") this.runGameAction("bench")
      if (key === "r") this.runGameAction("carry")
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
