import { getBenchOf, getOccupants, hasFreeSlot } from "lib/job/container-slots"
import {
  type JobRow,
  LINE_TABLES,
  TRANSFER_ROWS,
  UNIT_STAGES,
  type UnitStagePlan,
} from "lib/job/job-plan"
import { TABLE_PLACEMENTS, type TableId } from "lib/layout/station-layout"
import type { SimContext } from "lib/simulation/sim-context"
import type { SimTask } from "lib/tasks/coroutines"
import { walkToStation } from "lib/tasks/operator-motions"
import type { UnitStage } from "lib/world/create-world"
import type { Object3D } from "three"

export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder < 10 ? "0" : ""}${remainder.toFixed(1)}`
}

/** One step for one unit (or a one-off move, with unit 0). */
export interface WorkItem {
  row: JobRow
  unitIndex: number
  plan: UnitStagePlan | null
}

const STAGE_ORDER: UnitStage[] = [
  "raw",
  "assembled",
  "tested",
  "packed",
  "in_carton",
  "shipped",
]

function countUnitsBefore(
  params: { stage: UnitStage },
  ctx: SimContext,
): number {
  const limit = STAGE_ORDER.indexOf(params.stage)
  return ctx.world.units.filter(
    (unit) => STAGE_ORDER.indexOf(unit.stage) < limit,
  ).length
}

export function countUnitsAt(
  params: { stage: UnitStage },
  ctx: SimContext,
): number {
  return ctx.world.units.filter((unit) => unit.stage === params.stage).length
}

function getPlanFor(tableId: TableId): UnitStagePlan | null {
  return UNIT_STAGES.find((plan) => plan.tableId === tableId) ?? null
}

/** Is a unit waiting at this bench, in the container the bench works from? */
function isUnitAvailable(
  params: { plan: UnitStagePlan; unitIndex: number },
  ctx: SimContext,
): boolean {
  const { world } = ctx
  const unit = world.units[params.unitIndex]
  if (unit.stage !== params.plan.fromStage) return false
  if (unit.nextStepIndex > 0) return true
  const source = {
    assembly_bench: world.motorFoamStand,
    qc_bench: world.finishedRack,
    pack_out_bench: world.readyRack,
    ship_ready_bench: world.packingTote,
  }[
    params.plan.tableId as
      | "assembly_bench"
      | "qc_bench"
      | "pack_out_bench"
      | "ship_ready_bench"
  ]
  return (
    getBenchOf({ object: source.group }, ctx) === params.plan.tableId &&
    source.occupants.includes(params.unitIndex)
  )
}

/** Units waiting at a bench, or started there, for its per-unit work. */
export function countWaitingUnits(
  params: { tableId: TableId },
  ctx: SimContext,
): number {
  const plan = getPlanFor(params.tableId)
  if (!plan) return 0
  return ctx.world.units.filter((_, unitIndex) =>
    isUnitAvailable({ plan, unitIndex }, ctx),
  ).length
}

/** The next per-unit step at a bench: a unit already started there, else the next one waiting. */
export function getNextUnitWork(
  params: { tableId: TableId },
  ctx: SimContext,
): WorkItem | null {
  const plan = getPlanFor(params.tableId)
  if (!plan) return null
  const { units } = ctx.world
  const started = units.findIndex(
    (unit) => unit.stage === plan.fromStage && unit.nextStepIndex > 0,
  )
  const unitIndex =
    started !== -1
      ? started
      : units.findIndex((_, index) =>
          isUnitAvailable({ plan, unitIndex: index }, ctx),
        )
  if (unitIndex === -1) return null
  return { row: plan.rows[units[unitIndex].nextStepIndex], unitIndex, plan }
}

/** Why a work item can't run right now, or null. */
export function getWorkBlocker(item: WorkItem, ctx: SimContext): string | null {
  const { world } = ctx
  const own = item.row.step.getBlocker?.({ unitIndex: item.unitIndex }, ctx)
  if (own) return own
  if (!item.plan) return null
  const isLastStep = item.row === item.plan.rows.at(-1)
  if (!isLastStep) return null
  const destination = {
    assembly_bench: { container: world.finishedRack, name: "rack" },
    qc_bench: { container: world.readyRack, name: "ready rack" },
    pack_out_bench: { container: world.packingTote, name: "tote" },
    ship_ready_bench: { container: world.carton, name: "Amazon carton" },
  }[
    item.plan.tableId as
      | "assembly_bench"
      | "qc_bench"
      | "pack_out_bench"
      | "ship_ready_bench"
  ]
  const label = TABLE_PLACEMENTS[item.plan.tableId].label
  if (
    getBenchOf({ object: destination.container.group }, ctx) !==
    item.plan.tableId
  ) {
    return `The ${destination.name} isn't at the ${label}. Bring it back first.`
  }
  if (!hasFreeSlot(destination.container))
    return `The ${destination.name} is full. Move it on first.`
  return null
}

function isAt(
  params: { object: { group: Object3D }; tableId: TableId },
  ctx: SimContext,
): boolean {
  return getBenchOf({ object: params.object.group }, ctx) === params.tableId
}

/** What a bench does on its own once it has no per-unit work left. */
export function getFollowUp(
  params: { tableId: TableId },
  ctx: SimContext,
): WorkItem | null {
  const { world } = ctx
  const item = (row: JobRow): WorkItem => ({ row, unitIndex: 0, plan: null })
  if (params.tableId === "assembly_bench") {
    const isRackReady =
      isAt({ object: world.finishedRack, tableId: "assembly_bench" }, ctx) &&
      getOccupants(world.finishedRack).length > 0
    return isRackReady && countUnitsAt({ stage: "raw" }, ctx) === 0
      ? item(TRANSFER_ROWS.carryFinishedRack)
      : null
  }
  if (params.tableId === "qc_bench") {
    const hasReady =
      isAt({ object: world.readyRack, tableId: "qc_bench" }, ctx) &&
      getOccupants(world.readyRack).length > 0
    if (hasReady && countUnitsBefore({ stage: "tested" }, ctx) === 0)
      return item(TRANSFER_ROWS.carryReadyRack)
    const isRackEmptyHere =
      isAt({ object: world.finishedRack, tableId: "qc_bench" }, ctx) &&
      getOccupants(world.finishedRack).length === 0
    return isRackEmptyHere && countUnitsAt({ stage: "raw" }, ctx) > 0
      ? item(TRANSFER_ROWS.returnFinishedRack)
      : null
  }
  if (params.tableId === "pack_out_bench") {
    const hasPacked =
      isAt({ object: world.packingTote, tableId: "pack_out_bench" }, ctx) &&
      getOccupants(world.packingTote).length > 0
    if (hasPacked && countUnitsBefore({ stage: "packed" }, ctx) === 0)
      return item(TRANSFER_ROWS.carryTote)
    const isRackEmptyHere =
      isAt({ object: world.readyRack, tableId: "pack_out_bench" }, ctx) &&
      getOccupants(world.readyRack).length === 0
    return isRackEmptyHere && countUnitsBefore({ stage: "tested" }, ctx) > 0
      ? item(TRANSFER_ROWS.returnReadyRack)
      : null
  }
  if (params.tableId === "ship_ready_bench") {
    if (world.isCartonShipped) return null
    if (countUnitsBefore({ stage: "in_carton" }, ctx) === 0)
      return item(TRANSFER_ROWS.sealAndShip)
    const isToteEmptyHere =
      isAt({ object: world.packingTote, tableId: "ship_ready_bench" }, ctx) &&
      getOccupants(world.packingTote).length === 0
    return isToteEmptyHere ? item(TRANSFER_ROWS.returnTote) : null
  }
  return null
}

/** R: move whatever is ready on from this bench, take an empty container home, or ship what's in the carton. */
export function getCarryWork(
  params: { tableId: TableId },
  ctx: SimContext,
): { label: string; item: WorkItem } | null {
  const { world } = ctx
  const item = (row: JobRow): WorkItem => ({ row, unitIndex: 0, plan: null })
  const countIn = (container: { occupants: Array<number | null> }) =>
    getOccupants(container).length
  if (
    params.tableId === "assembly_bench" &&
    isAt({ object: world.finishedRack, tableId: "assembly_bench" }, ctx)
  ) {
    const count = countIn(world.finishedRack)
    if (count > 0)
      return {
        label: `Carry the rack to QC now (${count} assembled)`,
        item: item(TRANSFER_ROWS.carryFinishedRack),
      }
  }
  if (params.tableId === "qc_bench") {
    const count = countIn(world.readyRack)
    if (
      count > 0 &&
      isAt({ object: world.readyRack, tableId: "qc_bench" }, ctx)
    ) {
      return {
        label: `Carry the ready rack to pack-out now (${count} tested)`,
        item: item(TRANSFER_ROWS.carryReadyRack),
      }
    }
    if (
      isAt({ object: world.finishedRack, tableId: "qc_bench" }, ctx) &&
      countIn(world.finishedRack) === 0
    ) {
      return {
        label: "Take the empty rack back to assembly",
        item: item(TRANSFER_ROWS.returnFinishedRack),
      }
    }
  }
  if (params.tableId === "pack_out_bench") {
    const count = countIn(world.packingTote)
    if (
      count > 0 &&
      isAt({ object: world.packingTote, tableId: "pack_out_bench" }, ctx)
    ) {
      return {
        label: `Carry the tote to ship-ready now (${count} packed)`,
        item: item(TRANSFER_ROWS.carryTote),
      }
    }
    if (
      isAt({ object: world.readyRack, tableId: "pack_out_bench" }, ctx) &&
      countIn(world.readyRack) === 0
    ) {
      return {
        label: "Take the empty ready rack back to QC",
        item: item(TRANSFER_ROWS.returnReadyRack),
      }
    }
  }
  if (params.tableId === "ship_ready_bench" && !world.isCartonShipped) {
    const count = countIn(world.carton)
    if (count > 0)
      return {
        label: `Seal and ship the carton now (${count} boxes)`,
        item: item(TRANSFER_ROWS.sealAndShip),
      }
    if (
      isAt({ object: world.packingTote, tableId: "ship_ready_bench" }, ctx) &&
      countIn(world.packingTote) === 0
    ) {
      return {
        label: "Take the empty tote back to pack-out",
        item: item(TRANSFER_ROWS.returnTote),
      }
    }
  }
  return null
}

/** Walk to a work item's station and run it, timing it and moving the unit along. */
export function* runWorkItem(item: WorkItem, ctx: SimContext): SimTask {
  const { progress, world } = ctx
  const { step } = item.row
  const params = { unitIndex: item.unitIndex }
  progress.isJobActive = true
  yield* walkToStation(step.station, ctx)
  progress.isOperatorBusy = true
  progress.activeRowIndex = item.row.rowIndex
  ctx.cameraHint = {
    station: step.station,
    view: step.closeUpView,
    getFocusPoint: () => step.getFocusPoint(params, ctx),
  }
  yield* step.run(params, ctx)
  progress.activeRowIndex = null
  progress.rowCompletedCounts[item.row.rowIndex] += 1
  progress.isOperatorBusy = false
  ctx.cameraHint = null
  if (item.plan) {
    const unit = world.units[item.unitIndex]
    unit.nextStepIndex += 1
    if (unit.nextStepIndex >= item.plan.rows.length) {
      unit.stage = item.plan.toStage
      unit.nextStepIndex = 0
    }
  }
  if (world.isCartonShipped) {
    progress.isJobActive = false
    progress.isJobComplete = true
    ctx.statusText = `Carton shipped: ${countUnitsAt({ stage: "shipped" }, ctx)} units. Cycle time ${formatSeconds(progress.cycleSeconds)}`
  }
}

/** Work through everything waiting at a bench, then its follow-up move. Stops with a message when blocked. */
export function* runBench(
  params: { tableId: TableId },
  ctx: SimContext,
): SimTask {
  for (;;) {
    const work = getNextUnitWork(params, ctx)
    if (!work) break
    const blocker = getWorkBlocker(work, ctx)
    if (blocker) {
      ctx.statusText = blocker
      return
    }
    yield* runWorkItem(work, ctx)
  }
  const followUp = getFollowUp(params, ctx)
  if (followUp) yield* runWorkItem(followUp, ctx)
  else if (!ctx.progress.isJobComplete)
    ctx.statusText = `Nothing left to do at the ${TABLE_PLACEMENTS[params.tableId].label}`
}

/** Run the line bench by bench until the carton ships; stops if the user takes control or a bench is blocked. */
export function* runFullBatch(ctx: SimContext): SimTask {
  for (const tableId of LINE_TABLES) {
    yield* runBench({ tableId }, ctx)
    if (ctx.mode !== "simulation") return
    const pending = getNextUnitWork({ tableId }, ctx)
    if (pending && getWorkBlocker(pending, ctx)) return
  }
}

/** The next thing the line needs, at the first bench that has work: for the camera and the station ring. */
export function getNextLineWork(ctx: SimContext): WorkItem | null {
  for (const tableId of LINE_TABLES) {
    const work =
      getNextUnitWork({ tableId }, ctx) ?? getFollowUp({ tableId }, ctx)
    if (work) return work
  }
  return null
}

/** How many units sit at each stage, in line order, for the HUD. */
export function countUnitsByStage(
  ctx: SimContext,
): Array<{ stage: UnitStage; count: number }> {
  return STAGE_ORDER.map((stage) => ({
    stage,
    count: countUnitsAt({ stage }, ctx),
  }))
}
