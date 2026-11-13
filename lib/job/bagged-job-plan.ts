import {
  BAGGING_STAGE,
  LABEL_SEAL_AND_SHIP_STEP,
  LOAD_BAG_CARTON_STAGE,
} from "lib/job/bagging-steps"
import { KITTING_STAGE, TEST_MOTOR_QC_STAGE } from "lib/job/bare-unit-steps"
import {
  createJobPlan,
  type JobPlan,
  KIT_JOB_PLAN,
  type ProductLine,
} from "lib/job/job-plan"

/**
 * The bare-unit line, no motors: each unit's board, spacer, four long screws
 * and motor cable are kitted, the board is spin-tested on QC's one test motor,
 * and the kit goes in a 3" x 5" ESD bag with a tscircuit sticker and an FNSKU
 * label, 30 bags to a carton with an FBA box ID label.
 */
export const BAGGED_JOB_PLAN: JobPlan = createJobPlan({
  productLine: "bagged",
  assemblyStage: KITTING_STAGE,
  qcStage: TEST_MOTOR_QC_STAGE,
  packOutStage: BAGGING_STAGE,
  loadCartonStage: LOAD_BAG_CARTON_STAGE,
  sealAndShipStep: LABEL_SEAL_AND_SHIP_STEP,
})

export function getJobPlan(productLine: ProductLine): JobPlan {
  return productLine === "bagged" ? BAGGED_JOB_PLAN : KIT_JOB_PLAN
}
