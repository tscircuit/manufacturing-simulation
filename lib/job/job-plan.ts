import { BATCH_SIZE, type TableId } from "lib/layout/station-layout"
import {
  ASSEMBLY_STAGE,
  CARRY_FINISHED_RACK_STAGE,
} from "lib/job/assembly-bench-steps"
import type { JobStage, JobStep } from "lib/job/job-step"
import { CARRY_TOTE_STAGE, PACK_OUT_STAGE } from "lib/job/pack-out-steps"
import { CARRY_READY_RACK_STAGE, QC_STAGE } from "lib/job/qc-bench-steps"
import {
  LOAD_CARTON_STAGE,
  SEAL_AND_SHIP_STAGE,
} from "lib/job/ship-ready-steps"

/** The batch line, bench by bench. */
export const JOB_STAGES: JobStage[] = [
  ASSEMBLY_STAGE,
  CARRY_FINISHED_RACK_STAGE,
  QC_STAGE,
  CARRY_READY_RACK_STAGE,
  PACK_OUT_STAGE,
  CARRY_TOTE_STAGE,
  LOAD_CARTON_STAGE,
  SEAL_AND_SHIP_STAGE,
]

/** One row of the timing table: a step, timed across every unit it runs for. */
export interface JobRow {
  rowIndex: number
  stage: JobStage
  step: JobStep
  /** How many times the step runs in a batch. */
  runCount: number
}

export const JOB_ROWS: JobRow[] = JOB_STAGES.flatMap((stage) =>
  stage.steps.map((step) => ({ stage, step })),
).map(({ stage, step }, rowIndex) => ({
  rowIndex,
  stage,
  step,
  runCount: stage.isPerUnit ? BATCH_SIZE : 1,
}))

/** One step for one unit, in the order the line runs them. */
export interface WorkItem {
  workIndex: number
  row: JobRow
  unitIndex: number
  tableId: TableId
}

function buildWorkItems(): WorkItem[] {
  const items: Array<Omit<WorkItem, "workIndex">> = []
  let firstRowIndex = 0
  for (const stage of JOB_STAGES) {
    const stageRows = JOB_ROWS.slice(
      firstRowIndex,
      firstRowIndex + stage.steps.length,
    )
    firstRowIndex += stage.steps.length
    const unitCount = stage.isPerUnit ? BATCH_SIZE : 1
    for (let unitIndex = 0; unitIndex < unitCount; unitIndex++) {
      for (const row of stageRows)
        items.push({ row, unitIndex, tableId: row.step.station.tableId })
    }
  }
  return items.map((item, workIndex) => ({ ...item, workIndex }))
}

export const WORK_ITEMS: WorkItem[] = buildWorkItems()
