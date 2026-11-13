import { ASSEMBLY_STAGE } from "lib/job/assembly-bench-steps"
import type { JobStage, JobStep } from "lib/job/job-step"
import { PACK_OUT_STAGE } from "lib/job/pack-out-steps"
import { QC_STAGE } from "lib/job/qc-bench-steps"
import { LOAD_CARTON_STAGE } from "lib/job/ship-ready-steps"
import { TRANSFER_STEPS } from "lib/job/transfer-steps"
import { BATCH_SIZE, type TableId } from "lib/layout/station-layout"
import type { UnitStage } from "lib/world/create-world"

/** One row of the timing table: a step, timed across every time it runs. */
export interface JobRow {
  rowIndex: number
  step: JobStep
  /** How many times the step runs in a full batch; null for moves that happen as needed. */
  runCount: number | null
}

/** A bench's per-unit work: which units it takes, and the stage they leave with. */
export interface UnitStagePlan {
  stage: JobStage
  tableId: TableId
  fromStage: UnitStage
  toStage: UnitStage
  rows: JobRow[]
}

const rows: JobRow[] = []

function addRow(params: { step: JobStep; runCount: number | null }): JobRow {
  const row = { rowIndex: rows.length, ...params }
  rows.push(row)
  return row
}

function addUnitStage(params: {
  stage: JobStage
  tableId: TableId
  fromStage: UnitStage
  toStage: UnitStage
}): UnitStagePlan {
  return {
    ...params,
    rows: params.stage.steps.map((step) =>
      addRow({ step, runCount: BATCH_SIZE }),
    ),
  }
}

// Rows are added in the order the timing table shows them.
const assembly = addUnitStage({
  stage: ASSEMBLY_STAGE,
  tableId: "assembly_bench",
  fromStage: "raw",
  toStage: "assembled",
})
const carryFinishedRack = addRow({
  step: TRANSFER_STEPS.carryFinishedRack,
  runCount: 1,
})
const returnFinishedRack = addRow({
  step: TRANSFER_STEPS.returnFinishedRack,
  runCount: null,
})
const qc = addUnitStage({
  stage: QC_STAGE,
  tableId: "qc_bench",
  fromStage: "assembled",
  toStage: "tested",
})
const carryReadyRack = addRow({
  step: TRANSFER_STEPS.carryReadyRack,
  runCount: 1,
})
const returnReadyRack = addRow({
  step: TRANSFER_STEPS.returnReadyRack,
  runCount: null,
})
const packOut = addUnitStage({
  stage: PACK_OUT_STAGE,
  tableId: "pack_out_bench",
  fromStage: "tested",
  toStage: "packed",
})
const carryTote = addRow({ step: TRANSFER_STEPS.carryTote, runCount: 1 })
const returnTote = addRow({ step: TRANSFER_STEPS.returnTote, runCount: null })
const shipReady = addUnitStage({
  stage: LOAD_CARTON_STAGE,
  tableId: "ship_ready_bench",
  fromStage: "packed",
  toStage: "in_carton",
})
const sealAndShip = addRow({ step: TRANSFER_STEPS.sealAndShip, runCount: 1 })

/** Per-unit work at each line bench, in line order. */
export const UNIT_STAGES: UnitStagePlan[] = [assembly, qc, packOut, shipReady]

/** One-off moves between benches. */
export const TRANSFER_ROWS = {
  carryFinishedRack,
  returnFinishedRack,
  carryReadyRack,
  returnReadyRack,
  carryTote,
  returnTote,
  sealAndShip,
}

export const JOB_ROWS: JobRow[] = rows

/** The line benches in order; the printer and label benches support them. */
export const LINE_TABLES: TableId[] = UNIT_STAGES.map((plan) => plan.tableId)
