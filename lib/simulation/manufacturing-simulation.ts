import { Scene } from "three"
import { ASSEMBLY_JOB_STEPS } from "lib/job/assembly-job-steps"
import { OPERATOR_START } from "lib/layout/station-layout"
import { createRoomShell, type RoomShell } from "lib/models/room-shell"
import { createNavGrid } from "lib/navigation/nav-grid"
import { createOperator, resetOperator } from "lib/operator/create-operator"
import { updateOperatorPose } from "lib/operator/update-operator-pose"
import {
  applyWalkInput,
  type GameActions,
  getGameActions,
  type WalkInput,
} from "lib/simulation/game-actions"
import {
  assembleAndPackScenario,
  pickUpScrewdriverScenario,
  type ScenarioId,
  walkFloorScenario,
} from "lib/simulation/scenarios"
import type {
  JobProgress,
  SimContext,
  SimulationMode,
} from "lib/simulation/sim-context"
import type { SimTask } from "lib/tasks/coroutines"
import { createWorld } from "lib/world/create-world"

const NAV_GRID_CELL_SIZE_M = 0.1
const NAV_GRID_CLEARANCE_M = 0.27

function createJobProgress(): JobProgress {
  return {
    completedStepCount: 0,
    activeStepIndex: null,
    stepSeconds: ASSEMBLY_JOB_STEPS.map(() => 0),
    cycleSeconds: 0,
    isJobActive: false,
    isJobComplete: false,
    isOperatorBusy: false,
    isHoldingLooseScrewdriver: false,
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

  /** Put every part back in its starting place and the operator at the door. */
  reset(): void {
    this.activeTask = null
    const { ctx } = this
    // A foam insert or its carrier can be under the hand or scene during a move.
    ctx.world.foamInsertPair.removeFromParent()
    ctx.world.bottomFoam.removeFromParent()
    ctx.world.topFoam.removeFromParent()
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
  }

  startTask(task: SimTask): void {
    this.activeTask = task
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
    const canResumeJob =
      progress.completedStepCount > 0 &&
      !progress.isJobComplete &&
      !progress.isHoldingLooseScrewdriver
    if (!canResumeJob) this.reset()
    this.startTask(assembleAndPackScenario(this.ctx))
  }

  /** Switching to game mode stops any scenario that isn't mid-step. */
  setMode(mode: SimulationMode): void {
    const { ctx } = this
    ctx.mode = mode
    if (mode === "game") {
      if (this.activeTask && !ctx.progress.isOperatorBusy) {
        this.activeTask = null
        ctx.operator.walkSpeedMps = 0
      }
      if (!ctx.progress.isOperatorBusy) ctx.statusText = "You have control"
      return
    }
    if (!this.activeTask) ctx.statusText = "Pick a scenario"
  }

  setWalkInput(walkInput: WalkInput): void {
    this.walkInput = walkInput
  }

  getGameActions(): GameActions {
    return getGameActions({ isTaskRunning: this.isTaskRunning }, this.ctx)
  }

  /** Run the action bound to E ("step") or F ("screwdriver"), if available. */
  runGameAction(actionKind: "step" | "screwdriver"): boolean {
    const actions = this.getGameActions()
    const action =
      actionKind === "step" ? actions.stepAction : actions.screwdriverAction
    if (!action) return false
    this.startTask(action.createTask())
    return true
  }

  /** Advance the simulation by `dtSeconds` of simulated time. */
  step(dtSeconds: number): void {
    const { ctx } = this
    if (this.activeTask) {
      if (this.activeTask.next(dtSeconds).done) this.activeTask = null
    } else if (ctx.mode === "game") {
      applyWalkInput({ walkInput: this.walkInput, dtSeconds }, ctx)
    } else {
      ctx.operator.walkSpeedMps = 0
    }
    const { progress } = ctx
    if (progress.isJobActive) progress.cycleSeconds += dtSeconds
    if (progress.activeStepIndex !== null)
      progress.stepSeconds[progress.activeStepIndex] += dtSeconds
    updateOperatorPose(ctx.operator, dtSeconds)
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
