import { JOB_ROWS } from "lib/job/job-plan"
import { printLabelSheet, printLabelsNow } from "lib/job/label-collection"
import { advancePrinters, finishPrintsNow } from "lib/job/printer-steps"
import { OPERATOR_START } from "lib/layout/station-layout"
import { populatePlate } from "lib/models/bambu-printer"
import { updateFlexCable } from "lib/models/flex-cable"
import { createRoomShell, type RoomShell } from "lib/models/room-shell"
import { createNavGrid } from "lib/navigation/nav-grid"
import {
  createOperator,
  type OperatorHand,
  resetOperator,
} from "lib/operator/create-operator"
import { updateOperatorPose } from "lib/operator/update-operator-pose"
import {
  applyWalkInput,
  type GameActions,
  getGameActions,
  type WalkInput,
} from "lib/simulation/game-actions"
import { type LineStartId, setUpLineAt } from "lib/simulation/line-setup"
import {
  collectLabelsScenario,
  pickUpScrewdriverScenario,
  refillSpacersScenario,
  runBatchScenario,
  type ScenarioId,
  walkFloorScenario,
} from "lib/simulation/scenarios"
import type {
  JobProgress,
  SimContext,
  SimulationMode,
} from "lib/simulation/sim-context"
import type { SimTask } from "lib/tasks/coroutines"
import { walkTo } from "lib/tasks/operator-motions"
import { createWorld } from "lib/world/create-world"
import { Scene } from "three"

const NAV_GRID_CELL_SIZE_M = 0.1
const NAV_GRID_CLEARANCE_M = 0.27
/** About how long the Epson takes per AveneMark sheet, including feeding. */
const LABEL_SHEET_PRINT_SECONDS = 45
const MOVED_WHILE_PAUSED_M = 0.02

/** E runs the bench (or pauses a running task); R moves what's ready on; F handles the screwdriver. */
export type GameActionKind = "bench" | "carry" | "screwdriver"

/** Where the operator was and what each hand was doing when the task was paused. */
interface PausePose {
  x: number
  z: number
  ccwYawRadians: number
  hands: Array<{ hand: OperatorHand; isReaching: boolean }>
  hasWalkedAway: boolean
}

function createJobProgress(): JobProgress {
  return {
    activeRowIndex: null,
    rowSeconds: JOB_ROWS.map(() => 0),
    rowCompletedCounts: JOB_ROWS.map(() => 0),
    cycleSeconds: 0,
    isJobActive: false,
    isJobComplete: false,
    isOperatorBusy: false,
    isHoldingLooseScrewdriver: false,
  }
}

/** After walking away from a paused task, walk back to where it stopped, then carry on from exactly there. */
function* resumeWhereLeftOff(
  params: { task: SimTask; pausePose: PausePose },
  ctx: SimContext,
): SimTask {
  const { pausePose } = params
  const statusText = ctx.statusText
  ctx.statusText = "Walking back to where you paused"
  yield* walkTo(
    {
      x: pausePose.x,
      z: pausePose.z,
      finalCcwYawRadians: pausePose.ccwYawRadians,
    },
    ctx,
  )
  for (const { hand, isReaching } of pausePose.hands)
    hand.isReaching = isReaching
  ctx.statusText = statusText
  for (;;) {
    const dtSeconds = yield
    if (params.task.next(dtSeconds).done) return
  }
}

/**
 * The unit 322 floor, its benches and the operator, advanced in fixed steps.
 * Has no rendering or DOM dependencies, so it runs headless in tests.
 */
export class ManufacturingSimulation {
  readonly ctx: SimContext
  readonly roomShell: RoomShell
  private activeTask: SimTask | null = null
  private pausePose: PausePose | null = null
  private walkInput: WalkInput = {
    forward: 0,
    right: 0,
    cameraCcwYawRadians: 0,
  }

  constructor() {
    const scene = new Scene()
    this.roomShell = createRoomShell()
    const operator = createOperator()
    scene.add(this.roomShell.group, operator.group)
    this.ctx = {
      scene,
      world: createWorld(),
      operator,
      navGrid: createNavGrid({
        cellSizeM: NAV_GRID_CELL_SIZE_M,
        clearanceM: NAV_GRID_CLEARANCE_M,
      }),
      progress: createJobProgress(),
      mode: "simulation",
      statusText: "",
      cameraHint: null,
    }
    scene.add(this.ctx.world.root)
    this.reset()
  }

  get isTaskRunning(): boolean {
    return this.activeTask !== null
  }

  get isTaskPaused(): boolean {
    return this.activeTask !== null && this.pausePose !== null
  }

  /**
   * Put every part back in its starting place and the operator at the door.
   * Anything mid-move or in a hand belongs to the old world and goes with it.
   */
  reset(): void {
    this.activeTask = null
    this.pausePose = null
    const { ctx } = this
    ctx.scene.remove(ctx.world.root)
    ctx.world = createWorld()
    ctx.scene.add(ctx.world.root)
    ctx.progress = createJobProgress()
    ctx.cameraHint = null
    resetOperator({
      operator: ctx.operator,
      x: OPERATOR_START.xM,
      z: OPERATOR_START.zM,
      ccwYawRadians: OPERATOR_START.ccwYawRadians,
    })
    updateOperatorPose(ctx.operator, 1 / 60)
    for (const cable of ctx.world.cables) updateFlexCable(cable)
  }

  startTask(task: SimTask): void {
    this.activeTask = task
    this.pausePose = null
    // Run up to the first yield so the task sets its status immediately.
    if (task.next().done) this.activeTask = null
  }

  startScenario(scenarioId: ScenarioId): void {
    const { progress } = this.ctx
    if (scenarioId === "walk_floor") {
      this.reset()
      this.startTask(walkFloorScenario(this.ctx))
      return
    }
    if (scenarioId === "pick_up_screwdriver") {
      this.reset()
      this.startTask(pickUpScrewdriverScenario(this.ctx))
      return
    }
    if (progress.isOperatorBusy) return
    if (scenarioId === "refill_spacers") {
      this.startTask(refillSpacersScenario(this.ctx))
      return
    }
    if (scenarioId === "collect_labels") {
      this.startTask(collectLabelsScenario(this.ctx))
      return
    }
    // Carry on from wherever the line is; start over once the carton has shipped.
    if (progress.isJobComplete || progress.isHoldingLooseScrewdriver)
      this.reset()
    this.startTask(runBatchScenario(this.ctx))
  }

  /** Start over with the whole batch ready for one bench, and the operator standing at it. */
  startAt(startId: LineStartId): void {
    const { mode } = this.ctx
    this.reset()
    this.ctx.mode = mode
    setUpLineAt({ startId }, this.ctx)
    this.ctx.progress.isJobActive = startId !== "assembly"
    updateOperatorPose(this.ctx.operator, 1 / 60)
    for (const cable of this.ctx.world.cables) updateFlexCable(cable)
  }

  /** Finish the running 3D prints now. */
  finishPrintsNow(): void {
    finishPrintsNow(this.ctx)
  }

  /** Fill the label printer's output tray now. */
  printLabelsNow(): void {
    printLabelsNow(this.ctx)
  }

  /** Switching to game mode stops any scenario that isn't mid-step. */
  setMode(mode: SimulationMode): void {
    const { ctx } = this
    ctx.mode = mode
    if (mode === "game") {
      if (this.activeTask && !ctx.progress.isOperatorBusy) {
        this.activeTask = null
        this.pausePose = null
        ctx.operator.walkSpeedMps = 0
      }
      if (!this.activeTask) ctx.statusText = "You have control"
      return
    }
    if (!this.activeTask) ctx.statusText = "Pick a scenario"
  }

  /** Freeze the running task where it is, or carry on from there. */
  setTaskPaused(isPaused: boolean): void {
    const task = this.activeTask
    if (!task) return
    const { operator } = this.ctx
    if (isPaused && !this.pausePose) {
      operator.walkSpeedMps = 0
      this.pausePose = {
        x: operator.position.x,
        z: operator.position.z,
        ccwYawRadians: operator.ccwYawRadians,
        hands: operator.hands.map((hand) => ({
          hand,
          isReaching: hand.isReaching,
        })),
        hasWalkedAway: false,
      }
      return
    }
    if (isPaused || !this.pausePose) return
    const pausePose = this.pausePose
    this.pausePose = null
    if (pausePose.hasWalkedAway)
      this.activeTask = resumeWhereLeftOff({ task, pausePose }, this.ctx)
  }

  setWalkInput(walkInput: WalkInput): void {
    this.walkInput = walkInput
  }

  getGameActions(): GameActions {
    return getGameActions(
      { isTaskRunning: this.isTaskRunning, isTaskPaused: this.isTaskPaused },
      this.ctx,
    )
  }

  /** E ("bench") runs the bench or pauses/resumes; R ("carry") moves what's ready on; F handles the screwdriver. */
  runGameAction(actionKind: GameActionKind): boolean {
    if (this.activeTask && this.ctx.mode === "game") {
      if (actionKind !== "bench") return false
      this.setTaskPaused(!this.isTaskPaused)
      return true
    }
    const actions = this.getGameActions()
    const action =
      actionKind === "bench"
        ? actions.benchAction
        : actionKind === "carry"
          ? actions.carryAction
          : actions.screwdriverAction
    if (!action) return false
    this.startTask(action.createTask())
    return true
  }

  /** Advance the simulation by `dtSeconds` of simulated time. */
  step(dtSeconds: number): void {
    const { ctx } = this
    this.advanceEquipment(dtSeconds)
    if (this.activeTask && this.pausePose) {
      this.stepWhilePaused(dtSeconds)
      return
    }
    if (this.activeTask) {
      if (this.activeTask.next(dtSeconds).done) this.activeTask = null
    } else if (ctx.mode === "game") {
      applyWalkInput({ walkInput: this.walkInput, dtSeconds }, ctx)
    } else {
      ctx.operator.walkSpeedMps = 0
    }
    const { progress } = ctx
    if (progress.isJobActive) progress.cycleSeconds += dtSeconds
    if (progress.activeRowIndex !== null)
      progress.rowSeconds[progress.activeRowIndex] += dtSeconds
    updateOperatorPose(ctx.operator, dtSeconds)
    for (const cable of ctx.world.cables) updateFlexCable(cable)
  }

  /** Paused: nothing in the task moves and no time is counted, but in game mode the player can walk around. */
  private stepWhilePaused(dtSeconds: number): void {
    const { ctx } = this
    const pausePose = this.pausePose
    if (!pausePose) return
    if (ctx.mode === "game")
      applyWalkInput({ walkInput: this.walkInput, dtSeconds }, ctx)
    else ctx.operator.walkSpeedMps = 0
    const distanceM = Math.hypot(
      ctx.operator.position.x - pausePose.x,
      ctx.operator.position.z - pausePose.z,
    )
    if (!pausePose.hasWalkedAway && distanceM > MOVED_WHILE_PAUSED_M) {
      // Let the arms relax while walking; anything held in a hand comes along.
      pausePose.hasWalkedAway = true
      for (const hand of ctx.operator.hands)
        if (!hand.heldObject) hand.isReaching = false
    }
    updateOperatorPose(ctx.operator, dtSeconds)
    for (const cable of ctx.world.cables) updateFlexCable(cable)
  }

  /** Printers and the label printer keep working whatever the operator is doing. */
  private advanceEquipment(dtSeconds: number): void {
    const { ctx } = this
    advancePrinters({ dtSeconds, populate: populatePlate }, ctx)
    const labelPrinter = ctx.world.labelPrinter
    labelPrinter.secondsSinceLastSheet += dtSeconds
    if (labelPrinter.secondsSinceLastSheet < LABEL_SHEET_PRINT_SECONDS) return
    labelPrinter.secondsSinceLastSheet = 0
    printLabelSheet(ctx)
  }

  /** Step until the running task finishes or `maxSeconds` of simulated time pass. */
  runUntilIdle(params: { dtSeconds: number; maxSeconds: number }): void {
    for (
      let elapsedSeconds = 0;
      this.activeTask && elapsedSeconds < params.maxSeconds;
      elapsedSeconds += params.dtSeconds
    ) {
      this.step(params.dtSeconds)
    }
  }
}
