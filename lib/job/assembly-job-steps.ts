import { ASSEMBLY_BENCH_STEPS } from "lib/job/assembly-bench-steps"
import type { JobStep } from "lib/job/job-step"
import { PACK_OUT_STEPS } from "lib/job/pack-out-steps"
import { QC_BENCH_STEPS } from "lib/job/qc-bench-steps"
import { SPACER_BENCH_STEPS } from "lib/job/spacer-bench-steps"

/** The full line job for one unit, in order: spacer, assembly, QC, pack-out, ship-ready. */
export const ASSEMBLY_JOB_STEPS: JobStep[] = [
  ...SPACER_BENCH_STEPS,
  ...ASSEMBLY_BENCH_STEPS,
  ...QC_BENCH_STEPS,
  ...PACK_OUT_STEPS,
]
