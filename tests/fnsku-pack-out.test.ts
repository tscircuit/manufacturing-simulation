import { expect, test } from "bun:test"
import { PRINT_FNSKU_SHEET_ROW } from "lib/job/job-plan"
import { ManufacturingSimulation } from "lib/simulation/manufacturing-simulation"

test("the Epson feeds the FNSKU sheet and pack-out applies it after the tscircuit label", () => {
  const simulation = new ManufacturingSimulation()
  simulation.setJobUnitCount(1)
  simulation.setMode("game")
  simulation.startAt("pack_out")
  const { world, operator } = simulation.ctx
  const [unit] = world.units
  const bench = world.tables.pack_out_bench
  expect(world.labelSheets[0].group.parent).toBe(bench)
  expect(world.fnskuLabelSheets).toHaveLength(0)
  expect(simulation.runGameAction("bench")).toBe(true)

  let sawPaperFeed = false
  let sawCarry = false
  let sawSheetOnBench = false
  let sawBrandingFirst = false
  for (let frame = 0; frame < 2_000 && simulation.isTaskRunning; frame++) {
    simulation.step(0.05)
    const sheet = world.labelPrinter.activeFnskuSheet
    sawPaperFeed ||= Boolean(
      sheet?.group.parent === world.labelPrinter.group &&
        sheet.group.position.z > 0.1,
    )
    sawCarry ||= sheet?.group.parent === operator.group
    sawSheetOnBench ||= world.fnskuLabelSheets[0]?.group.parent === bench
    sawBrandingFirst ||=
      unit.label?.parent === unit.box.lid && unit.fnskuLabel === null
  }

  expect(simulation.isTaskRunning).toBe(false)
  expect(sawPaperFeed && sawCarry && sawSheetOnBench && sawBrandingFirst).toBe(
    true,
  )
  expect(world.labelPrinter.activeFnskuSheet).toBeNull()
  expect(world.fnskuLabelSheets[0].labels).toHaveLength(29)
  expect(
    simulation.ctx.progress.rowCompletedCounts[PRINT_FNSKU_SHEET_ROW.rowIndex],
  ).toBe(1)
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
  simulation.startScenario("run_batch")
  simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 3000 })
  const { world, progress } = simulation.ctx
  const packed = world.units.slice(0, 25)

  expect(progress.isJobComplete).toBe(true)
  expect(world.fnskuLabelSheets).toHaveLength(1)
  expect(world.fnskuLabelSheets[0].labels).toHaveLength(5)
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
