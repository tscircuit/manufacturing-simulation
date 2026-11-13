import type { JobStep, UnitParams } from "lib/job/job-step"
import { STATIONS } from "lib/layout/station-layout"
import { INKJET_OUTPUT } from "lib/models/inkjet-printer"
import {
  createLabelSheet,
  LABEL_SHEET,
  LABEL_SHEET_STACK_PITCH_M,
} from "lib/models/label-sheet"
import type { SimContext } from "lib/simulation/sim-context"
import { playCue } from "lib/simulation/sound-cues"
import { pickUpInFront, setDownFromCarry } from "lib/tasks/carry-motions"
import { type SimTask, tween, waitSeconds } from "lib/tasks/coroutines"
import { trackObjectPoint, walkToStation } from "lib/tasks/operator-motions"
import { LABEL_BENCH_SPOTS, PACK_OUT_BENCH_SPOTS } from "lib/world/bench-spots"
import { Group, Object3D, Vector3 } from "three"

/** Sheets the label printer's output tray holds before it has to be emptied. */
export const MAX_PRINTED_LABEL_SHEETS = 6
const FNSKU_SHEET_FEED_SECONDS = 3.4
const FNSKU_PRINT_VIEW = {
  azimuthRadians: -0.65,
  elevationRadians: 0.78,
  distanceM: 0.75,
}
const FNSKU_SHEET_FEED_START = new Vector3(
  INKJET_OUTPUT.xM,
  INKJET_OUTPUT.yM + 0.0005,
  INKJET_OUTPUT.zM - LABEL_SHEET.lengthM / 2,
)
// Leave the trailing edge on the output tray while the front hangs over it.
const FNSKU_SHEET_FEED_END = FNSKU_SHEET_FEED_START.clone().add(
  new Vector3(0, 0, LABEL_SHEET.lengthM + 0.003),
)

/** Print a sample 30-up sheet on the existing Epson and put it beside the branding stock. */
function* printFnskuSheetForPackOut(
  _params: UnitParams,
  ctx: SimContext,
): SimTask {
  const { world } = ctx
  const { labelPrinter, fnskuLabelSheets } = world
  const sheet = createLabelSheet("fnsku")
  labelPrinter.activeFnskuSheet = sheet
  labelPrinter.group.add(sheet.group)
  ctx.statusText = "Printing the sample FNSKU sheet"
  ctx.cameraHint = {
    station: STATIONS.labelPrinter,
    view: FNSKU_PRINT_VIEW,
    getFocusPoint: trackObjectPoint({ object: sheet.group }),
    isCut: true,
  }
  playCue("label_printer", ctx)
  yield* tween({
    durationSeconds: FNSKU_SHEET_FEED_SECONDS,
    onProgress: (progress) => {
      sheet.group.position.lerpVectors(
        FNSKU_SHEET_FEED_START,
        FNSKU_SHEET_FEED_END,
        progress,
      )
    },
  })

  const leftGrip = new Object3D()
  const rightGrip = new Object3D()
  leftGrip.position.set(-LABEL_SHEET.widthM * 0.42, 0.001, 0.06)
  rightGrip.position.set(LABEL_SHEET.widthM * 0.42, 0.001, 0.06)
  sheet.group.add(leftGrip, rightGrip)
  ctx.statusText = "Picking up the printed FNSKU sheet"
  yield* pickUpInFront({ item: sheet.group, leftGrip, rightGrip }, ctx)
  // Both hands are tracking the sheet. Register it so the pause action can park it.
  ctx.operator.rightHand.heldObject = sheet.group
  ctx.statusText = "Carrying the printed FNSKU sheet to pack-out"
  ctx.cameraHint = null
  yield* walkToStation(STATIONS.packOut, ctx)

  const rest = PACK_OUT_BENCH_SPOTS.fnskuLabelSheets
    .clone()
    .add(new Vector3(0, fnskuLabelSheets.length * LABEL_SHEET_STACK_PITCH_M, 0))
  const bench = world.tables.pack_out_bench
  ctx.statusText = "Setting the FNSKU sheet on the pack-out bench"
  ctx.cameraHint = {
    station: STATIONS.packOut,
    view: { azimuthRadians: -0.6, elevationRadians: 1.05, distanceM: 0.72 },
    getFocusPoint: trackObjectPoint({ object: bench, localPoint: rest }),
    isCut: true,
  }
  ctx.operator.rightHand.heldObject = null
  yield* setDownFromCarry(
    { item: sheet.group, toParent: bench, toPosition: rest },
    ctx,
  )
  sheet.group.remove(leftGrip, rightGrip)
  fnskuLabelSheets.unshift(sheet)
  labelPrinter.activeFnskuSheet = null
  ctx.statusText = "FNSKU sheet ready beside the tscircuit labels"
  yield* waitSeconds(0.6)
}

export const PRINT_FNSKU_SHEET_STEP: JobStep = {
  label: "Print and bring FNSKU sheet to pack-out",
  station: STATIONS.labelPrinter,
  closeUpView: FNSKU_PRINT_VIEW,
  getFocusPoint: (_params, ctx) =>
    trackObjectPoint({
      object: ctx.world.labelPrinter.group,
      localPoint: FNSKU_SHEET_FEED_END,
    })(),
  run: printFnskuSheetForPackOut,
}

/** Add one printed sheet to the top of the label printer's output tray. */
export function printLabelSheet(ctx: SimContext): boolean {
  const { labelPrinter } = ctx.world
  if (
    labelPrinter.activeFnskuSheet?.group.parent === labelPrinter.group ||
    labelPrinter.printedSheets.length >= MAX_PRINTED_LABEL_SHEETS
  )
    return false
  const sheet = createLabelSheet()
  sheet.group.position.y =
    labelPrinter.printedSheets.length * LABEL_SHEET_STACK_PITCH_M
  sheet.group.rotation.y =
    (labelPrinter.printedSheets.length % 2 === 0 ? 1 : -1) * 0.03
  labelPrinter.outputStack.add(sheet.group)
  labelPrinter.printedSheets.push(sheet)
  playCue("label_printer", ctx)
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
    .add(new Vector3(0, visibleSheets * LABEL_SHEET_STACK_PITCH_M, 0))
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
