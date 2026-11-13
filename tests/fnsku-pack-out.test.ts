import { expect, test } from "bun:test"
import { countLabelsAtPackOut } from "lib/job/label-stock"
import { getStationStandPose } from "lib/layout/get-station-stand-pose"
import { STATIONS } from "lib/layout/station-layout"
import { LABEL_SHEET } from "lib/models/label-sheet"
import { STICKER } from "lib/models/sticker"
import { ManufacturingSimulation } from "lib/simulation/manufacturing-simulation"
import { METERS_PER_INCH } from "lib/units"

test("pack-out peels a single pre-stocked 2×3 label for the NEMA17 box", () => {
  const simulation = new ManufacturingSimulation()
  simulation.setJobUnitCount(1)
  simulation.setMode("game")
  simulation.startAt("pack_out")
  const { world, operator } = simulation.ctx
  const [unit] = world.units
  const [sheet] = world.labelSheets
  const [sticker] = sheet.labels
  const bench = world.tables.pack_out_bench
  const printer = getStationStandPose(STATIONS.labelPrinter)
  const stockBefore = countLabelsAtPackOut(world)
  expect(sheet.group.parent).toBe(bench)
  expect(sheet.labels).toHaveLength(
    LABEL_SHEET.columnCount * LABEL_SHEET.rowCount,
  )
  expect(STICKER.widthM).toBe(2 * METERS_PER_INCH)
  expect(STICKER.lengthM).toBe(3 * METERS_PER_INCH)
  expect(simulation.runGameAction("bench")).toBe(true)

  let visitedPrinter = false
  for (let frame = 0; frame < 2_000 && simulation.isTaskRunning; frame++) {
    simulation.step(0.05)
    visitedPrinter ||=
      Math.hypot(
        operator.position.x - printer.x,
        operator.position.z - printer.z,
      ) < 0.25
  }

  expect(simulation.isTaskRunning).toBe(false)
  expect(visitedPrinter).toBe(false)
  expect(countLabelsAtPackOut(world)).toBe(stockBefore - 1)
  expect(unit.stage).toBe("packed")
  expect(unit.label).toBe(sticker)
  expect(sticker.parent).toBe(unit.box.lid)
  expect(sticker.position.equals(unit.box.stickerSpot.position)).toBe(true)

  simulation.startAt("ship_ready")
  const [packed] = simulation.ctx.world.units
  expect(packed.label?.parent).toBe(packed.box.lid)
  expect(countLabelsAtPackOut(simulation.ctx.world)).toBe(stockBefore - 1)
})

test("25 retail boxes ship with 25 combined labels", () => {
  const simulation = new ManufacturingSimulation()
  simulation.setJobUnitCount(25)
  simulation.startAt("pack_out")
  const stockBefore = countLabelsAtPackOut(simulation.ctx.world)
  simulation.startScenario("run_batch")
  simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 3000 })
  const { world, progress } = simulation.ctx
  const packed = world.units.slice(0, 25)
  const unitLabels = new Set(packed.map((unit) => unit.label))

  expect(progress.isJobComplete).toBe(true)
  expect(countLabelsAtPackOut(world)).toBe(stockBefore - 25)
  expect(unitLabels.size).toBe(25)
  for (const unit of packed) {
    expect(unit.stage).toBe("shipped")
    expect(unit.label?.parent).toBe(unit.box.lid)
    expect(unit.label?.position.equals(unit.box.stickerSpot.position)).toBe(
      true,
    )
  }
})
