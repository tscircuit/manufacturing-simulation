import {
  BAGGING_STAGE,
  LABEL_SEAL_AND_SHIP_STEP,
  LOAD_BAG_CARTON_STAGE,
} from "lib/job/bagging-steps"
import {
  createJobPlan,
  type JobPlan,
  KIT_JOB_PLAN,
  type ProductLine,
} from "lib/job/job-plan"

/**
 * The bare-unit line: the same assembly and QC as the kit, then each tested
 * unit goes in a 4" x 6" ESD bag with a tscircuit sticker and an FNSKU label,
 * 30 bags to a carton with an FBA box ID label.
 */
export const BAGGED_JOB_PLAN: JobPlan = createJobPlan({
  productLine: "bagged",
  packOutStage: BAGGING_STAGE,
  loadCartonStage: LOAD_BAG_CARTON_STAGE,
  sealAndShipStep: LABEL_SEAL_AND_SHIP_STEP,
})

export function getJobPlan(productLine: ProductLine): JobPlan {
  return productLine === "bagged" ? BAGGED_JOB_PLAN : KIT_JOB_PLAN
}
