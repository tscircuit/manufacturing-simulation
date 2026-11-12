import { ASSEMBLY_BENCH_STEPS } from "lib/job/assembly-bench-steps"
import { FOAM_CUTTING_STEPS } from "lib/job/foam-cutting-steps"
import type { JobStep } from "lib/job/job-step"
import { PACK_OUT_STEPS } from "lib/job/pack-out-steps"
import { PRINTER_STEPS } from "lib/job/printer-steps"

/** The full assemble-and-pack job, in order. */
export const ASSEMBLY_JOB_STEPS: JobStep[] = [
  ...PRINTER_STEPS,
  ...ASSEMBLY_BENCH_STEPS,
  ...FOAM_CUTTING_STEPS,
  ...PACK_OUT_STEPS,
]
