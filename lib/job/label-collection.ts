import { STATIONS } from "lib/layout/station-layout"
import { createLabelSheet, LABEL_SHEET } from "lib/models/label-sheet"
import type { SimContext } from "lib/simulation/sim-context"
import { pickUpInFront, setDownFromCarry } from "lib/tasks/carry-motions"
import type { SimTask } from "lib/tasks/coroutines"
import { walkToStation } from "lib/tasks/operator-motions"
import { LABEL_BENCH_SPOTS, PACK_OUT_BENCH_SPOTS } from "lib/world/bench-spots"
import { Group, Object3D, Vector3 } from "three"

/** Sheets the label printer's output tray holds before it has to be emptied. */
export const MAX_PRINTED_LABEL_SHEETS = 6
const SHEET_THICKNESS_M = 0.0006

/** Add one printed sheet to the top of the label printer's output tray. */
export function printLabelSheet(ctx: SimContext): boolean {
  const { labelPrinter } = ctx.world
  if (labelPrinter.printedSheets.length >= MAX_PRINTED_LABEL_SHEETS)
    return false
  const sheet = createLabelSheet()
  // Peel the front row first.
  sheet.labels.reverse()
  sheet.group.position.y = labelPrinter.printedSheets.length * SHEET_THICKNESS_M
  sheet.group.rotation.y =
    (labelPrinter.printedSheets.length % 2 === 0 ? 1 : -1) * 0.03
  labelPrinter.outputStack.add(sheet.group)
  labelPrinter.printedSheets.push(sheet)
  return true
}

/** Fill the output tray now, as if the printer had been running a while. */
export function printLabelsNow(ctx: SimContext): void {
  while (printLabelSheet(ctx)) {
    // Keep printing until the tray is full.
  }
}

/** Carry every printed sheet from the label printer to the top of the stack at pack-out. */
export function* collectPrintedLabels(ctx: SimContext): SimTask {
  const { world } = ctx
  const sheets = [...world.labelPrinter.printedSheets]
  if (sheets.length === 0) return
  ctx.progress.isOperatorBusy = true
  yield* walkToStation(STATIONS.labelPrinter, ctx)
  ctx.statusText = `Picking up ${sheets.length} printed label sheets`
  const labelBench = world.tables.label_bench
  const bundle = new Group()
  labelBench.add(bundle)
  bundle.position.copy(LABEL_BENCH_SPOTS.printedSheets)
  bundle.updateMatrixWorld(true)
  for (const sheet of sheets) bundle.attach(sheet.group)
  world.labelPrinter.printedSheets = []
  const leftGrip = new Object3D()
  leftGrip.position.set(-LABEL_SHEET.widthM / 2, 0.002, 0)
  const rightGrip = new Object3D()
  rightGrip.position.set(LABEL_SHEET.widthM / 2, 0.002, 0)
  bundle.add(leftGrip, rightGrip)
  yield* pickUpInFront({ item: bundle, leftGrip, rightGrip }, ctx)

  ctx.statusText = `Carrying ${sheets.length} label sheets to pack-out`
  yield* walkToStation(STATIONS.packOutLabels, ctx)
  const packBench = world.tables.pack_out_bench
  const visibleSheets = world.labelSheets.filter(
    (sheet) => sheet.group.visible,
  ).length
  const stackTop = PACK_OUT_BENCH_SPOTS.labelSheets
    .clone()
    .add(new Vector3(0, visibleSheets * SHEET_THICKNESS_M, 0))
  yield* setDownFromCarry(
    { item: bundle, toParent: packBench, toPosition: stackTop },
    ctx,
  )
  packBench.updateMatrixWorld(true)
  for (const sheet of sheets) packBench.attach(sheet.group)
  bundle.removeFromParent()
  // The last printed sheet is on top.
  world.labelSheets.unshift(...[...sheets].reverse())
  ctx.progress.isOperatorBusy = false
  ctx.statusText = `${sheets.length} label sheets added at pack-out`
}
