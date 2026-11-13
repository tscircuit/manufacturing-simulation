import { expect, test } from "bun:test"
import { countLabelsOnSheets } from "lib/job/label-stock"
import { getStationStandPose } from "lib/layout/get-station-stand-pose"
import { STATIONS } from "lib/layout/station-layout"
import { ManufacturingSimulation } from "lib/simulation/manufacturing-simulation"

test("pack-out starts with FNSKU stock and applies it after the tscircuit label", () => {
  const simulation = new ManufacturingSimulation()
  simulation.setJobUnitCount(1)
  simulation.setMode("game")
  simulation.startAt("pack_out")
  const { world, operator } = simulation.ctx
  const [unit] = world.units
  const bench = world.tables.pack_out_bench
  const printer = getStationStandPose(STATIONS.labelPrinter)
  const stockBefore = countLabelsOnSheets(world.fnskuLabelSheets)
  expect(world.labelSheets[0].group.parent).toBe(bench)
  expect(stockBefore).toBeGreaterThanOrEqual(25)
  for (const sheet of world.fnskuLabelSheets) {
    expect(sheet.group.parent).toBe(bench)
    expect(sheet.labels).toHaveLength(30)
  }
  expect(simulation.runGameAction("bench")).toBe(true)

  let visitedPrinter = false
  let sawBrandingFirst = false
  for (let frame = 0; frame < 2_000 && simulation.isTaskRunning; frame++) {
    simulation.step(0.05)
    visitedPrinter ||=
      Math.hypot(
        operator.position.x - printer.x,
        operator.position.z - printer.z,
      ) < 0.25
    sawBrandingFirst ||=
      unit.label?.parent === unit.box.lid && unit.fnskuLabel === null
  }

  expect(simulation.isTaskRunning).toBe(false)
  expect(visitedPrinter).toBe(false)
  expect(sawBrandingFirst).toBe(true)
  expect(countLabelsOnSheets(world.fnskuLabelSheets)).toBe(stockBefore - 1)
  expect(unit.stage).toBe("packed")
  expect(unit.label?.parent).toBe(unit.box.lid)
  expect(unit.fnskuLabel?.parent).toBe(unit.box.lid)

  simulation.startAt("ship_ready")
  const [packed] = simulation.ctx.world.units
  expect(packed.label?.parent).toBe(packed.box.lid)
  expect(packed.fnskuLabel?.parent).toBe(packed.box.lid)
})

test("all 25 retail boxes ship with both labels applied", () => {
  const simulation = new ManufacturingSimulation()
  simulation.setJobUnitCount(25)
  simulation.startAt("pack_out")
  const stockBefore = countLabelsOnSheets(simulation.ctx.world.fnskuLabelSheets)
  simulation.startScenario("run_batch")
  simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 3000 })
  const { world, progress } = simulation.ctx
  const packed = world.units.slice(0, 25)

  expect(progress.isJobComplete).toBe(true)
  expect(countLabelsOnSheets(world.fnskuLabelSheets)).toBe(stockBefore - 25)
  expect(new Set(packed.map((unit) => unit.fnskuLabel)).size).toBe(25)
  for (const unit of packed) {
    expect(unit.stage).toBe("shipped")
    expect(unit.label?.parent).toBe(unit.box.lid)
    expect(unit.fnskuLabel?.parent).toBe(unit.box.lid)
    expect(
      unit.fnskuLabel?.position.equals(unit.box.fnskuStickerSpot.position),
    ).toBe(true)
  }
})
