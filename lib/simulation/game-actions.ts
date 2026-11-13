import {
  assembleOneMotor,
  canAssembleAnother,
  countUnitsAt,
  countWaitingUnits,
  getCarryWork,
  getFollowUp,
  getNextUnitWork,
  getWorkBlocker,
  runBench,
  runWorkItem,
} from "lib/job/bench-work"
import { collectPrintedLabels } from "lib/job/label-collection"
import {
  collectFinishedPlates,
  getFinishedPrinters,
  refillSpacerBasket,
} from "lib/job/printer-steps"
import {
  pickUpLooseScrewdriver,
  putBackLooseScrewdriver,
} from "lib/job/screwdriver-motions"
import {
  TABLE_PLACEMENTS,
  type TableId,
  WORK_TABLE,
} from "lib/layout/station-layout"
import { isFloorPointFree } from "lib/navigation/is-floor-point-free"
import { OPERATOR_GAME_WALK_SPEED_MPS } from "lib/operator/operator-body"
import {
  getAssemblyPadAtOperator,
  getEquipmentPadAtOperator,
  getPadJob,
} from "lib/simulation/equipment-pads"
import type { SideJob, SimContext } from "lib/simulation/sim-context"
import type { SimTask } from "lib/tasks/coroutines"
import { getAngleDifferenceRadians } from "lib/tasks/operator-motions"

/** Something the player can do from where they stand. */
export interface GameAction {
  label: string
  createTask: () => SimTask
}

export interface GameActions {
  /** E: run this bench's work, collect prints or labels, or refill spacers. */
  benchAction: GameAction | null
  /** R: move what's ready on to the next bench, return an empty container, or ship the carton. */
  carryAction: GameAction | null
  /** F: pick up or put back the screwdriver. */
  screwdriverAction: GameAction | null
  /** Paused and standing on a printer or label-printer circle: E does that job now; C goes back to the paused work after. */
  sideJobAction: SideJob | null
  /** C: go back to the paused work and carry on. */
  resumeLabel: string | null
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
    const outM = dx * sin + dz * cos - WORK_TABLE.depthM / 2
    if (
      Math.abs(alongM) < WORK_TABLE.lengthM / 2 + 0.2 &&
      outM > 0 &&
      outM < BENCH_REACH_M
    )
      return tableId
  }
  return null
}

function getLineBenchAction(
  params: { tableId: TableId },
  ctx: SimContext,
): { action: GameAction | null; blockedReason: string | null } {
  const { tableId } = params
  const label = TABLE_PLACEMENTS[tableId].label
  const work = getNextUnitWork({ tableId }, ctx)
  if (work) {
    const blockedReason = getWorkBlocker(work, ctx)
    if (blockedReason) return { action: null, blockedReason }
    const waiting = countWaitingUnits({ tableId }, ctx)
    return {
      action: {
        label: `Run the ${label} (${waiting} ${waiting === 1 ? "unit" : "units"})`,
        createTask: () => runBench({ tableId }, ctx),
      },
      blockedReason: null,
    }
  }
  const followUp = getFollowUp({ tableId }, ctx)
  if (followUp)
    return {
      action: {
        label: followUp.row.step.label,
        createTask: () => runWorkItem(followUp, ctx),
      },
      blockedReason: null,
    }
  return { action: null, blockedReason: null }
}

/**
 * Building one motor at a time: on the build circle (or anywhere else at the
 * bench) E builds one more motor into the rack; on the rack circle E takes
 * the rack, however full, to QC.
 */
function getOneAtATimeAssemblyActions(
  params: { actions: GameActions },
  ctx: SimContext,
): GameActions {
  const { actions } = params
  const carry = getCarryWork({ tableId: "assembly_bench" }, ctx)
  if (carry)
    actions.carryAction = {
      label: carry.label,
      createTask: () => runWorkItem(carry.item, ctx),
    }
  const inRack = countUnitsAt({ stage: "assembled" }, ctx)
  if (getAssemblyPadAtOperator(ctx)?.id === "rack") {
    actions.benchAction = actions.carryAction
    if (!carry)
      actions.blockedReason =
        inRack === 0
          ? "The rack is empty: build a motor on the other circle first"
          : "The rack isn't on this bench"
    return actions
  }
  if (!canAssembleAnother(ctx)) {
    actions.blockedReason =
      "All 30 motors are built: take the rack to QC from the rack circle"
    return actions
  }
  actions.benchAction = {
    label:
      ctx.world.productLine === "bagged"
        ? `Kit a unit (${inRack} in the rack)`
        : `Assemble a motor (${inRack} in the rack)`,
    createTask: () => assembleOneMotor(ctx),
  }
  return actions
}

/** What the player can do right now. While a task runs, only pausing is offered. */
export function getGameActions(
  params: {
    isTaskRunning: boolean
    isTaskPaused: boolean
    isSideTaskRunning: boolean
  },
  ctx: SimContext,
): GameActions {
  const actions: GameActions = {
    benchAction: null,
    carryAction: null,
    screwdriverAction: null,
    pauseLabel: null,
    blockedReason: null,
    sideJobAction: null,
    resumeLabel: null,
  }
  if (ctx.mode !== "game") return actions
  if (params.isSideTaskRunning) return actions
  if (params.isTaskRunning) {
    actions.pauseLabel = params.isTaskPaused ? "Resume" : "Pause"
    if (!params.isTaskPaused) return actions
    actions.resumeLabel = "Go back and carry on"
    const pad = getEquipmentPadAtOperator(ctx)
    if (!pad) return actions
    const isCarryingLoad = ctx.operator.group.children.some(
      (child) => child.userData.isCarried,
    )
    if (isCarryingLoad) {
      actions.blockedReason =
        "Set down what you're carrying first: press C to carry on with it"
      return actions
    }
    actions.sideJobAction = getPadJob(pad, ctx)
    if (!actions.sideJobAction)
      actions.blockedReason =
        pad.id === "label_printer"
          ? "No printed label sheets yet. Press C to carry on."
          : "No finished plates yet. Press C to carry on."
    return actions
  }
  const { progress, operator, world } = ctx
  const tableId = getBenchAtOperator(ctx)
  const handsAreEmpty =
    !operator.leftHand.heldObject &&
    !operator.rightHand.heldObject &&
    !world.carriedTub

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
    if (finishedCount > 0 && (handsAreEmpty || world.carriedTub)) {
      actions.benchAction = {
        label: `Collect ${finishedCount === 1 ? "the finished plate" : `${finishedCount} finished plates`} into a tub`,
        createTask: () => collectFinishedPlates(ctx),
      }
    }
    return actions
  }
  if (tableId === "label_bench") {
    const sheetCount = world.labelPrinter.printedSheets.length
    if (sheetCount > 0 && handsAreEmpty) {
      actions.benchAction = {
        label: `Take ${sheetCount} printed label ${sheetCount === 1 ? "sheet" : "sheets"} to pack-out`,
        createTask: () => collectPrintedLabels(ctx),
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
  if (
    tableId === "assembly_bench" &&
    progress.isOneAtATime &&
    handsAreEmpty &&
    !progress.isJobComplete
  )
    return getOneAtATimeAssemblyActions({ actions }, ctx)
  if (!handsAreEmpty || !ctx.jobPlan.lineTables.includes(tableId))
    return actions
  const { action, blockedReason } = getLineBenchAction({ tableId }, ctx)
  actions.benchAction = action
  actions.blockedReason = blockedReason
  const carry = getCarryWork({ tableId }, ctx)
  if (carry)
    actions.carryAction = {
      label: carry.label,
      createTask: () => runWorkItem(carry.item, ctx),
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
