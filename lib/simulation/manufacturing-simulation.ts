import { getJobPlan } from "lib/job/bagged-job-plan"
import type { JobPlan, ProductLine } from "lib/job/job-plan"
import { printLabelSheet, printLabelsNow } from "lib/job/label-collection"
import { advancePrinters, finishPrintsNow } from "lib/job/printer-steps"
import { getSideJobAt, runPendingSideJob } from "lib/job/side-jobs"
import {
  BARE_UNIT_TABLE_LAYOUT,
  BATCH_SIZE,
  getLayoutPlacements,
  KIT_TABLE_LAYOUT,
  OPERATOR_START,
} from "lib/layout/station-layout"
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
  type ParkedObject,
  parkHeldWork,
  unparkWork,
} from "lib/simulation/pause-parking"
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
  SideJob,
  SimContext,
  SimulationMode,
} from "lib/simulation/sim-context"
import type { SimTask } from "lib/tasks/coroutines"
import { walkTo } from "lib/tasks/operator-motions"
import { createWorld } from "lib/world/create-world"
import { Scene, type Vector3 } from "three"

const NAV_GRID_CELL_SIZE_M = 0.1
const NAV_GRID_CLEARANCE_M = 0.27
/** About how long the Epson takes per AveneMark sheet, including feeding. */
const LABEL_SHEET_PRINT_SECONDS = 45
const MOVED_WHILE_PAUSED_M = 0.02

/** E runs the bench (or pauses/resumes); R moves what's ready on; F handles the screwdriver; C resumes paused work. */
export type GameActionKind = "bench" | "carry" | "screwdriver" | "resume"

/** What a hand was doing when the task was paused, so it can pick up exactly there. */
interface PausedHand {
  hand: OperatorHand
  isReaching: boolean
  trackTarget: OperatorHand["trackTarget"]
  targetFingerCurl: number
  targetFingerDirection: Vector3
}

/** Where the operator was, what each hand was doing, and what got set down, when the task was paused. */
interface PausePose {
  x: number
  z: number
  ccwYawRadians: number
  hands: PausedHand[]
  hasWalkedAway: boolean
  parked: ParkedObject[]
  /** Job state the paused task expects back after any equipment job done in between. */
  progress: {
    isOperatorBusy: boolean
    activeRowIndex: number | null
    cameraHint: SimContext["cameraHint"]
    statusText: string
  }
}

function restoreHands(pausePose: PausePose): void {
  for (const paused of pausePose.hands) {
    paused.hand.trackTarget = paused.trackTarget
    paused.hand.targetFingerCurl = paused.targetFingerCurl
    paused.hand.targetFingerDirection.copy(paused.targetFingerDirection)
    paused.hand.isReaching = paused.isReaching
  }
}

function createJobProgress(params: {
  unitCount: number
  jobPlan: JobPlan
}): JobProgress {
  const { unitCount, jobPlan } = params
  return {
    unitCount,
    isOneAtATime: unitCount === 1,
    activeRowIndex: null,
    rowSeconds: jobPlan.rows.map(() => 0),
    rowCompletedCounts: jobPlan.rows.map(() => 0),
    cycleSeconds: 0,
    isJobActive: false,
    isJobComplete: false,
    isOperatorBusy: false,
    isHoldingLooseScrewdriver: false,
    pendingSideJob: null,
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
  ctx.statusText = "Picking the work back up"
  yield* unparkWork({ parked: pausePose.parked }, ctx)
  restoreHands(pausePose)
  ctx.progress.isOperatorBusy = pausePose.progress.isOperatorBusy
  ctx.progress.activeRowIndex = pausePose.progress.activeRowIndex
  ctx.cameraHint = pausePose.progress.cameraHint
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
  /** A printer or label job done while the main task is paused. */
  private sideTask: SimTask | null = null
  /** How many units the next job runs: the full batch of 30, or 1 motor start to ship. */
  private unitCount: number = BATCH_SIZE
  private pausePose: PausePose | null = null
  private walkInput: WalkInput = {
    forward: 0,
    right: 0,
    cameraCcwYawRadians: 0,
  }

  /** The full kit (default) or the bare unit in an ESD bag. */
  readonly productLine: ProductLine

  constructor(params: { productLine?: ProductLine } = {}) {
    this.productLine = params.productLine ?? "kit"
    const jobPlan = getJobPlan(this.productLine)
    const tableLayout =
      this.productLine === "bagged" ? BARE_UNIT_TABLE_LAYOUT : KIT_TABLE_LAYOUT
    const scene = new Scene()
    this.roomShell = createRoomShell()
    const operator = createOperator()
    scene.add(this.roomShell.group, operator.group)
    this.ctx = {
      scene,
      world: createWorld({ productLine: this.productLine }),
      operator,
      navGrid: createNavGrid({
        cellSizeM: NAV_GRID_CELL_SIZE_M,
        clearanceM: NAV_GRID_CLEARANCE_M,
        tables: getLayoutPlacements(tableLayout),
      }),
      progress: createJobProgress({ unitCount: BATCH_SIZE, jobPlan }),
      jobPlan,
      tableLayout,
      mode: "simulation",
      statusText: "",
      cameraHint: null,
      soundCues: [],
    }
    scene.add(this.ctx.world.root)
    this.reset()
  }

  get isTaskRunning(): boolean {
    return this.activeTask !== null
  }

  get isSideTaskRunning(): boolean {
    return this.sideTask !== null
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
    this.sideTask = null
    this.pausePose = null
    const { ctx } = this
    ctx.scene.remove(ctx.world.root)
    ctx.world = createWorld({ productLine: this.productLine })
    ctx.scene.add(ctx.world.root)
    ctx.progress = createJobProgress({
      unitCount: this.unitCount,
      jobPlan: ctx.jobPlan,
    })
    ctx.cameraHint = null
    ctx.soundCues.length = 0
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
    if (
      this.activeTask &&
      progress.isJobActive &&
      (scenarioId === "refill_spacers" || scenarioId === "collect_labels")
    ) {
      // A batch is running: fit the job in after the current unit instead of stopping the batch.
      const sideJob = getSideJobAt(
        {
          tableId:
            scenarioId === "refill_spacers" ? "printer_bench" : "label_bench",
        },
        this.ctx,
      )
      if (sideJob) this.requestSideJob(sideJob)
      else
        this.ctx.statusText =
          scenarioId === "refill_spacers"
            ? "No printer has a finished plate yet. Use “3D prints are ready” to finish them."
            : "The label printer hasn't printed any sheets yet. Use “Labels printed” to fill its tray."
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

  get jobUnitCount(): number {
    return this.unitCount
  }

  /** Run the full batch or a single motor from now on. Starts the line over. */
  setJobUnitCount(unitCount: number): void {
    const { mode } = this.ctx
    this.unitCount = Math.min(BATCH_SIZE, Math.max(1, Math.round(unitCount)))
    this.reset()
    this.ctx.mode = mode
    this.ctx.statusText =
      this.unitCount === 1
        ? "One at a time: E on the green circle builds a motor; the amber circle takes the rack to QC"
        : `Full batch: ${this.unitCount} motors`
  }

  /** Finish the running 3D prints now. */
  finishPrintsNow(): void {
    finishPrintsNow(this.ctx)
  }

  /** Fill the label printer's output tray now. */
  printLabelsNow(): void {
    printLabelsNow(this.ctx)
  }

  /** Fit printer or label work in after the current unit of the running task. */
  private requestSideJob(sideJob: SideJob): void {
    this.ctx.progress.pendingSideJob = sideJob
    this.ctx.statusText = `After this unit: ${sideJob.label}`
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
          trackTarget: hand.trackTarget,
          targetFingerCurl: hand.targetFingerCurl,
          targetFingerDirection: hand.targetFingerDirection.clone(),
        })),
        hasWalkedAway: false,
        parked: [],
        progress: {
          isOperatorBusy: this.ctx.progress.isOperatorBusy,
          activeRowIndex: this.ctx.progress.activeRowIndex,
          cameraHint: this.ctx.cameraHint,
          statusText: this.ctx.statusText,
        },
      }
      return
    }
    if (isPaused || !this.pausePose || this.sideTask) return
    const pausePose = this.pausePose
    this.pausePose = null
    if (pausePose.hasWalkedAway)
      this.activeTask = resumeWhereLeftOff({ task, pausePose }, this.ctx)
    else restoreHands(pausePose)
  }

  setWalkInput(walkInput: WalkInput): void {
    this.walkInput = walkInput
  }

  getGameActions(): GameActions {
    return getGameActions(
      {
        isTaskRunning: this.isTaskRunning,
        isTaskPaused: this.isTaskPaused,
        isSideTaskRunning: this.isSideTaskRunning,
      },
      this.ctx,
    )
  }

  /** E ("bench") runs the bench or pauses/resumes; R ("carry") moves what's ready on; F handles the screwdriver. */
  runGameAction(actionKind: GameActionKind): boolean {
    if (this.activeTask && this.ctx.mode === "game") {
      if (this.sideTask) return false
      if (actionKind === "resume") {
        if (!this.isTaskPaused) return false
        this.setTaskPaused(false)
        return true
      }
      if (actionKind !== "bench") return false
      const { sideJobAction } = this.getGameActions()
      if (sideJobAction) {
        this.startSideTask(sideJobAction)
        return true
      }
      this.setTaskPaused(!this.isTaskPaused)
      return true
    }
    if (actionKind === "resume") return false
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
      if (this.activeTask.next(dtSeconds).done) {
        this.activeTask = null
        // A side job asked for during a task that had no unit boundary left runs now.
        if (ctx.progress.pendingSideJob) this.startTask(runPendingSideJob(ctx))
      }
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

  /** Do a printer or label job now, while the main task stays paused; C goes back to it afterwards. */
  private startSideTask(sideJob: SideJob): void {
    const pausePose = this.pausePose
    if (!pausePose) return
    this.walkAwayFromPausedWork(pausePose)
    this.sideTask = sideJob.createTask()
    if (this.sideTask.next().done) this.finishSideTask()
  }

  private finishSideTask(): void {
    this.sideTask = null
    const { ctx } = this
    ctx.progress.isOperatorBusy = false
    ctx.cameraHint = null
    ctx.operator.walkSpeedMps = 0
    ctx.statusText = `${ctx.statusText}. Press C to go back and carry on.`
  }

  /** Set down what was in hand or mid-move and let the arms relax, once per pause. */
  private walkAwayFromPausedWork(pausePose: PausePose): void {
    if (pausePose.hasWalkedAway) return
    pausePose.hasWalkedAway = true
    pausePose.parked = parkHeldWork(this.ctx)
    for (const hand of this.ctx.operator.hands) {
      hand.isReaching = false
      hand.trackTarget = null
    }
  }

  /** Paused: nothing in the task moves and no time is counted, but in game mode the player can walk around. */
  private stepWhilePaused(dtSeconds: number): void {
    const { ctx } = this
    const pausePose = this.pausePose
    if (!pausePose) return
    if (this.sideTask) {
      if (this.sideTask.next(dtSeconds).done) this.finishSideTask()
      if (ctx.progress.isJobActive) ctx.progress.cycleSeconds += dtSeconds
      updateOperatorPose(ctx.operator, dtSeconds)
      for (const cable of ctx.world.cables) updateFlexCable(cable)
      return
    }
    if (ctx.mode === "game")
      applyWalkInput({ walkInput: this.walkInput, dtSeconds }, ctx)
    else ctx.operator.walkSpeedMps = 0
    const distanceM = Math.hypot(
      ctx.operator.position.x - pausePose.x,
      ctx.operator.position.z - pausePose.z,
    )
    if (distanceM > MOVED_WHILE_PAUSED_M) this.walkAwayFromPausedWork(pausePose)
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
