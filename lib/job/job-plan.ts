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
  /** Runs once per unit, so a smaller job runs it fewer times. */
  isPerUnit: boolean
}

/** A bench's per-unit work: which units it takes, and the stage they leave with. */
export interface UnitStagePlan {
  stage: JobStage
  tableId: TableId
  fromStage: UnitStage
  toStage: UnitStage
  rows: JobRow[]
}

/** Which product the line makes: the boxed full kit, or the bare unit in an ESD bag. */
export type ProductLine = "kit" | "bagged"

/** One-off moves between benches, by what they do. */
export interface TransferRows {
  carryFinishedRack: JobRow
  returnFinishedRack: JobRow
  carryReadyRack: JobRow
  returnReadyRack: JobRow
  carryTote: JobRow
  returnTote: JobRow
  sealAndShip: JobRow
}

/** Everything the line does for one product: per-unit stages, transfers and the timing rows. */
export interface JobPlan {
  productLine: ProductLine
  /** Per-unit work at each line bench, in line order. */
  unitStages: UnitStagePlan[]
  transferRows: TransferRows
  /** Every timing row, in the order the timing table shows them. */
  rows: JobRow[]
  /** The line benches in order; the printer and label benches support them. */
  lineTables: TableId[]
}

/** Build a line's plan. Only the pack-out work, the carton loading and the sealing differ between products. */
export function createJobPlan(params: {
  productLine: ProductLine
  /** Defaults to the kit's assembly and QC. */
  assemblyStage?: JobStage
  qcStage?: JobStage
  packOutStage: JobStage
  loadCartonStage: JobStage
  sealAndShipStep: JobStep
}): JobPlan {
  const rows: JobRow[] = []
  const addRow = (row: {
    step: JobStep
    runCount: number | null
    isPerUnit?: boolean
  }): JobRow => {
    const added = {
      rowIndex: rows.length,
      ...row,
      isPerUnit: row.isPerUnit ?? false,
    }
    rows.push(added)
    return added
  }
  const addUnitStage = (stage: {
    stage: JobStage
    tableId: TableId
    fromStage: UnitStage
    toStage: UnitStage
  }): UnitStagePlan => ({
    ...stage,
    rows: stage.stage.steps.map((step) =>
      addRow({ step, runCount: BATCH_SIZE, isPerUnit: true }),
    ),
  })
  // Rows are added in the order the timing table shows them.
  const assembly = addUnitStage({
    stage: params.assemblyStage ?? ASSEMBLY_STAGE,
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
    stage: params.qcStage ?? QC_STAGE,
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
    stage: params.packOutStage,
    tableId: "pack_out_bench",
    fromStage: "tested",
    toStage: "packed",
  })
  const carryTote = addRow({ step: TRANSFER_STEPS.carryTote, runCount: 1 })
  const returnTote = addRow({ step: TRANSFER_STEPS.returnTote, runCount: null })
  const shipReady = addUnitStage({
    stage: params.loadCartonStage,
    tableId: "ship_ready_bench",
    fromStage: "packed",
    toStage: "in_carton",
  })
  const sealAndShip = addRow({ step: params.sealAndShipStep, runCount: 1 })
  const unitStages = [assembly, qc, packOut, shipReady]
  return {
    productLine: params.productLine,
    unitStages,
    transferRows: {
      carryFinishedRack,
      returnFinishedRack,
      carryReadyRack,
      returnReadyRack,
      carryTote,
      returnTote,
      sealAndShip,
    },
    rows,
    lineTables: unitStages.map((plan) => plan.tableId),
  }
}

/** The full kit: boxed with cables, charger and label, 30 mailers to an Amazon carton. */
export const KIT_JOB_PLAN = createJobPlan({
  productLine: "kit",
  packOutStage: PACK_OUT_STAGE,
  loadCartonStage: LOAD_CARTON_STAGE,
  sealAndShipStep: TRANSFER_STEPS.sealAndShip,
})

/** Per-unit work at each line bench of the full kit line, in line order. */
export const UNIT_STAGES: UnitStagePlan[] = KIT_JOB_PLAN.unitStages
/** One-off moves between benches on the full kit line. */
export const TRANSFER_ROWS = KIT_JOB_PLAN.transferRows
export const JOB_ROWS: JobRow[] = KIT_JOB_PLAN.rows
/** The line benches in order; the printer and label benches support them. */
export const LINE_TABLES: TableId[] = KIT_JOB_PLAN.lineTables
