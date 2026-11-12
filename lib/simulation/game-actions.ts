import {
  FOLDING_TABLE,
  TABLE_PLACEMENTS,
  type TableId,
} from "lib/layout/station-layout"
import { WORK_ITEMS } from "lib/job/job-plan"
import {
  collectFinishedPlates,
  getFinishedPrinters,
  refillSpacerBasket,
} from "lib/job/printer-steps"
import {
  getNextWorkBlocker,
  runWorkUntilBenchChanges,
} from "lib/job/run-work-item"
import {
  pickUpLooseScrewdriver,
  putBackLooseScrewdriver,
} from "lib/job/screwdriver-motions"
import { isFloorPointFree } from "lib/navigation/is-floor-point-free"
import { OPERATOR_GAME_WALK_SPEED_MPS } from "lib/operator/operator-body"
import type { SimContext } from "lib/simulation/sim-context"
import type { SimTask } from "lib/tasks/coroutines"
import { getAngleDifferenceRadians } from "lib/tasks/operator-motions"

/** Something the player can do from where they stand. */
export interface GameAction {
  label: string
  createTask: () => SimTask
}

export interface GameActions {
  /** E: run this bench's work, collect prints, or refill spacers. */
  benchAction: GameAction | null
  /** F: pick up or put back the screwdriver. */
  screwdriverAction: GameAction | null
  /** While a task runs, E pauses or resumes it in place. */
  pauseLabel: "Pause" | "Resume" | null
  /** Why E can't run this bench's work right now. */
  blockedReason: string | null
}

/** Joystick-style input, -1..1 on each axis, relative to the camera's heading. */
export interface WalkInput {
  forward: number
  right: number
  cameraCcwYawRadians: number
}

const BENCH_REACH_M = 1.15
const PLAYER_CLEARANCE_M = 0.25
const TURN_RATE_RADIANS_PER_SECOND = 9
const INPUT_DEAD_ZONE = 0.15

/** The bench the operator is standing at, if any: in front of a table, within reach of its edge. */
export function getBenchAtOperator(ctx: SimContext): TableId | null {
  const { x, z } = ctx.operator.position
  for (const tableId of Object.keys(TABLE_PLACEMENTS) as TableId[]) {
    const table = TABLE_PLACEMENTS[tableId]
    const dx = x - table.centerXM
    const dz = z - table.centerZM
    const cos = Math.cos(table.ccwYawRadians)
    const sin = Math.sin(table.ccwYawRadians)
    const alongM = dx * cos - dz * sin
    const outM = dx * sin + dz * cos - FOLDING_TABLE.depthM / 2
    if (
      Math.abs(alongM) < FOLDING_TABLE.lengthM / 2 + 0.2 &&
      outM > 0 &&
      outM < BENCH_REACH_M
    )
      return tableId
  }
  return null
}

function getRemainingWorkAtBench(
  params: { tableId: TableId },
  ctx: SimContext,
): number {
  let count = 0
  for (const item of WORK_ITEMS.slice(ctx.progress.completedWorkCount)) {
    if (item.tableId !== params.tableId) break
    count++
  }
  return count
}

/** What the player can do right now. While a task runs, only pausing is offered. */
export function getGameActions(
  params: { isTaskRunning: boolean; isTaskPaused: boolean },
  ctx: SimContext,
): GameActions {
  const actions: GameActions = {
    benchAction: null,
    screwdriverAction: null,
    pauseLabel: null,
    blockedReason: null,
  }
  if (ctx.mode !== "game") return actions
  if (params.isTaskRunning) {
    actions.pauseLabel = params.isTaskPaused ? "Resume" : "Pause"
    return actions
  }
  const { progress, operator, world } = ctx
  const tableId = getBenchAtOperator(ctx)
  const handsAreEmpty =
    !operator.leftHand.heldObject && !operator.rightHand.heldObject

  if (tableId === "assembly_bench" && progress.isHoldingLooseScrewdriver) {
    actions.screwdriverAction = {
      label: "Put the screwdriver back",
      createTask: () => putBackLooseScrewdriver(ctx),
    }
    return actions
  }
  if (tableId === "assembly_bench" && handsAreEmpty) {
    actions.screwdriverAction = {
      label: "Pick up the screwdriver",
      createTask: () => pickUpLooseScrewdriver(ctx),
    }
  }
  if (!tableId || progress.isHoldingLooseScrewdriver) return actions

  if (tableId === "printer_bench") {
    const finishedCount = getFinishedPrinters(ctx).length
    if (finishedCount > 0 && handsAreEmpty) {
      actions.benchAction = {
        label: `Collect ${finishedCount === 1 ? "the finished plate" : `${finishedCount} finished plates`} into a tub`,
        createTask: () => collectFinishedPlates(ctx),
      }
    }
    return actions
  }
  if (tableId === "assembly_bench" && world.carriedTub) {
    actions.benchAction = {
      label: `Refill the spacer basket (${world.tubSpacers.length} spacers)`,
      createTask: () => refillSpacerBasket(ctx),
    }
    return actions
  }
  const remaining = getRemainingWorkAtBench({ tableId }, ctx)
  if (remaining === 0 || !handsAreEmpty) return actions
  actions.blockedReason = getNextWorkBlocker(ctx)
  if (actions.blockedReason) return actions
  actions.benchAction = {
    label: `Run the ${TABLE_PLACEMENTS[tableId].label} (${remaining} steps left)`,
    createTask: () => runWorkUntilBenchChanges({ tableId }, ctx),
  }
  return actions
}

/** Move the operator from player input, sliding along walls and tables. */
export function applyWalkInput(
  params: { walkInput: WalkInput; dtSeconds: number },
  ctx: SimContext,
): void {
  const { walkInput, dtSeconds } = params
  const { operator } = ctx
  let { forward, right } = walkInput
  const magnitude = Math.hypot(forward, right)
  if (magnitude < INPUT_DEAD_ZONE) {
    operator.walkSpeedMps = 0
    return
  }
  if (magnitude > 1) {
    forward /= magnitude
    right /= magnitude
  }
  // The camera looks along -(sin yaw, cos yaw); "forward" walks away from the camera.
  const forwardX = -Math.sin(walkInput.cameraCcwYawRadians)
  const forwardZ = -Math.cos(walkInput.cameraCcwYawRadians)
  const moveX = forwardX * forward - forwardZ * right
  const moveZ = forwardZ * forward + forwardX * right
  const speedMps = OPERATOR_GAME_WALK_SPEED_MPS * Math.min(1, magnitude)
  const turnRadians = getAngleDifferenceRadians({
    fromRadians: operator.ccwYawRadians,
    toRadians: Math.atan2(moveX, moveZ),
  })
  const maxTurnRadians = TURN_RATE_RADIANS_PER_SECOND * dtSeconds
  operator.ccwYawRadians += Math.max(
    -maxTurnRadians,
    Math.min(maxTurnRadians, turnRadians),
  )

  const nextX = operator.position.x + moveX * speedMps * dtSeconds
  const nextZ = operator.position.z + moveZ * speedMps * dtSeconds
  let hasMoved = false
  if (
    isFloorPointFree({
      x: nextX,
      z: operator.position.z,
      clearanceM: PLAYER_CLEARANCE_M,
    })
  ) {
    operator.position.x = nextX
    hasMoved = true
  }
  if (
    isFloorPointFree({
      x: operator.position.x,
      z: nextZ,
      clearanceM: PLAYER_CLEARANCE_M,
    })
  ) {
    operator.position.z = nextZ
    hasMoved = true
  }
  operator.walkSpeedMps = hasMoved ? speedMps : 0
}
