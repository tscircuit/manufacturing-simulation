import {
  BAGGING_STAGE,
  LABEL_SEAL_AND_SHIP_STEP,
  LOAD_BAG_CARTON_STAGE,
} from "lib/job/bagging-steps"
import { BOARD_TEST_STAGE } from "lib/job/board-test-steps"
import {
  createJobPlan,
  type JobPlan,
  KIT_JOB_PLAN,
  type ProductLine,
} from "lib/job/job-plan"

/**
 * The bare-unit line, no assembly bench and no motors to ship: boards start
 * in a tray at QC and each is spin-tested on the one test motor. At bagging
 * the four screws go in a pink pouch, then the spacer, board, cable and pouch
 * go in a 3" x 5" ESD bag with a tscircuit sticker and an FNSKU label, 30
 * bags to a carton with an FBA box ID label.
 */
export const BAGGED_JOB_PLAN: JobPlan = createJobPlan({
  productLine: "bagged",
  assemblyStage: null,
  qcStage: BOARD_TEST_STAGE,
  packOutStage: BAGGING_STAGE,
  loadCartonStage: LOAD_BAG_CARTON_STAGE,
  sealAndShipStep: LABEL_SEAL_AND_SHIP_STEP,
})

export function getJobPlan(productLine: ProductLine): JobPlan {
  return productLine === "bagged" ? BAGGED_JOB_PLAN : KIT_JOB_PLAN
}
