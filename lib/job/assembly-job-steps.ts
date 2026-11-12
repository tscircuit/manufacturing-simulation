import { ASSEMBLY_BENCH_STEPS } from "lib/job/assembly-bench-steps"
import type { JobStep } from "lib/job/job-step"
import { PACK_OUT_STEPS } from "lib/job/pack-out-steps"
import { QC_BENCH_STEPS } from "lib/job/qc-bench-steps"

/** The full line job for one unit, in order: assembly, QC, pack-out, ship-ready. */
export const ASSEMBLY_JOB_STEPS: JobStep[] = [
  ...ASSEMBLY_BENCH_STEPS,
  ...QC_BENCH_STEPS,
  ...PACK_OUT_STEPS,
]
