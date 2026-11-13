import { expect, test } from "bun:test"
import { getOccupants } from "lib/job/container-slots"
import { MAX_PRINTED_LABEL_SHEETS } from "lib/job/label-collection"
import { countLabelsAtPackOut } from "lib/job/label-stock"
import { getStationStandPose } from "lib/layout/get-station-stand-pose"
import {
  BATCH_SIZE,
  STATIONS,
  type Station,
  WORK_TABLE,
} from "lib/layout/station-layout"
import { ManufacturingSimulation } from "lib/simulation/manufacturing-simulation"
import { Box3, Vector3 } from "three"

function standAt(params: {
  simulation: ManufacturingSimulation
  station: Station
}): void {
  const pose = getStationStandPose(params.station)
  params.simulation.ctx.operator.position.set(pose.x, 0, pose.z)
  params.simulation.ctx.operator.ccwYawRadians = pose.ccwYawRadians
}

test("jumping to QC puts all 30 assembled units in the rack at the QC bench", () => {
  const simulation = new ManufacturingSimulation()
  simulation.setMode("game")
  simulation.startAt("qc")
  const { world } = simulation.ctx
  expect(world.units.every((unit) => unit.stage === "assembled")).toBe(true)
  expect(world.finishedRack.group.parent).toBe(world.tables.qc_bench)
  expect(
    world.units.every(
      (unit) => unit.motor.group.parent === world.finishedRack.group,
    ),
  ).toBe(true)
  expect(simulation.getGameActions().benchAction?.label).toBe(
    `Run the QC bench (${BATCH_SIZE} units)`,
  )
})

test(
  "every jump ships the carton when the line runs on from there",
  () => {
    for (const startId of ["pack_out", "ship_ready"] as const) {
      const simulation = new ManufacturingSimulation()
      simulation.startAt(startId)
      simulation.startScenario("run_batch")
      simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 4000 })
      const { world, progress } = simulation.ctx
      expect(progress.isJobComplete).toBe(true)
      expect(world.units.every((unit) => unit.stage === "shipped")).toBe(true)
    }
  },
  { timeout: 120_000 },
)

test(
  "R carries a partly filled rack to QC before all 30 are assembled, and QC tests them",
  () => {
    const simulation = new ManufacturingSimulation()
    simulation.setMode("game")
    const { ctx } = simulation
    const countAssembled = () =>
      ctx.world.units.filter((unit) => unit.stage === "assembled").length
    standAt({ simulation, station: STATIONS.assembly })
    simulation.runGameAction("bench")
    for (
      let elapsedSeconds = 0;
      !(countAssembled() >= 3 && !ctx.progress.isOperatorBusy) &&
      elapsedSeconds < 900;
      elapsedSeconds += 0.05
    )
      simulation.step(0.05)
    // Between units, re-taking control stops the bench run.
    simulation.setMode("game")
    expect(simulation.isTaskRunning).toBe(false)
    expect(simulation.getGameActions().carryAction?.label).toBe(
      "Carry the rack to QC now (3 assembled)",
    )
    simulation.runGameAction("carry")
    simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 120 })
    expect(ctx.world.finishedRack.group.parent).toBe(ctx.world.tables.qc_bench)

    simulation.runGameAction("bench")
    simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 900 })
    expect(
      ctx.world.units.filter((unit) => unit.stage === "tested"),
    ).toHaveLength(3)
    // The empty rack goes back for the rest of the batch.
    expect(ctx.world.finishedRack.group.parent).toBe(
      ctx.world.tables.assembly_bench,
    )
  },
  { timeout: 120_000 },
)

test("3D prints ready finishes both printers so their plates can be collected", () => {
  const simulation = new ManufacturingSimulation()
  const { world } = simulation.ctx
  simulation.startScenario("refill_spacers")
  simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 600 })
  expect(world.printers.every((printer) => printer.isPrinting)).toBe(true)
  simulation.finishPrintsNow()
  expect(world.printers.every((printer) => !printer.isPrinting)).toBe(true)
  expect(world.printers.map((printer) => printer.plateSpacers.length)).toEqual([
    25, 49,
  ])
})

test("printed label sheets are collected and stacked at pack-out", () => {
  const simulation = new ManufacturingSimulation()
  const { world } = simulation.ctx
  const labelsBefore = countLabelsAtPackOut(world)
  simulation.printLabelsNow()
  expect(world.labelPrinter.printedSheets).toHaveLength(
    MAX_PRINTED_LABEL_SHEETS,
  )
  simulation.startScenario("collect_labels")
  simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 300 })
  expect(world.labelPrinter.printedSheets).toHaveLength(0)
  expect(countLabelsAtPackOut(world)).toBe(
    labelsBefore + MAX_PRINTED_LABEL_SHEETS * 10,
  )
  for (const sheet of world.labelSheets)
    expect(sheet.group.parent).toBe(world.tables.pack_out_bench)
})

test("1 motor runs a single unit start to ship; the rest stay on the foam stand", () => {
  const simulation = new ManufacturingSimulation()
  simulation.setJobUnitCount(1)
  simulation.startScenario("run_batch")
  simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 3000 })
  const { world, progress } = simulation.ctx
  expect(progress.isJobComplete).toBe(true)
  expect(world.units[0].stage).toBe("shipped")
  expect(world.units[0].box.group.parent).toBe(world.carton.group)
  expect(world.units.slice(1).every((unit) => unit.stage === "raw")).toBe(true)
  expect(getOccupants(world.motorFoamStand)).toHaveLength(BATCH_SIZE - 1)
  expect(progress.cycleSeconds).toBeLessThan(400)
})

test("1 motor can jump straight to QC", () => {
  const simulation = new ManufacturingSimulation()
  simulation.setMode("game")
  simulation.setJobUnitCount(1)
  simulation.startAt("qc")
  expect(simulation.getGameActions().benchAction?.label).toBe(
    "Run the QC bench (1 unit)",
  )
})

test(
  "paused mid-screw, the player walks to the P2S circle, E collects and refills now, C goes back and finishes the motor",
  () => {
    const simulation = new ManufacturingSimulation()
    simulation.setMode("game")
    const { ctx } = simulation
    const { world } = ctx
    standAt({ simulation, station: STATIONS.assembly })
    simulation.runGameAction("bench")
    for (
      let elapsedSeconds = 0;
      !ctx.statusText.includes("driving long screw 2") && elapsedSeconds < 300;
      elapsedSeconds += 0.05
    )
      simulation.step(0.05)
    simulation.step(0.4)
    simulation.runGameAction("bench")
    expect(simulation.isTaskPaused).toBe(true)

    // Walking away sets the screwdriver down on the bench instead of carrying it or leaving it in mid-air.
    standAt({ simulation, station: STATIONS.p2s })
    simulation.step(0.05)
    const screwdriver = world.screwdriver.group
    expect(screwdriver.parent).toBe(world.root)
    const screwdriverBounds = new Box3().setFromObject(screwdriver)
    expect(screwdriverBounds.min.y).toBeCloseTo(WORK_TABLE.topHeightM, 2)
    expect(ctx.operator.rightHand.heldObject).toBeNull()

    const actions = simulation.getGameActions()
    expect(actions.sideJobAction?.label).toContain("refill the spacers")
    expect(actions.resumeLabel).not.toBeNull()
    const spacersBefore = world.spacerStock.length
    expect(simulation.runGameAction("bench")).toBe(true)
    expect(simulation.isSideTaskRunning).toBe(true)
    for (
      let elapsedSeconds = 0;
      simulation.isSideTaskRunning && elapsedSeconds < 300;
      elapsedSeconds += 0.05
    )
      simulation.step(0.05)
    expect(world.printers.every((printer) => printer.isPrinting)).toBe(true)
    expect(world.spacerStock.length).toBeGreaterThan(spacersBefore)
    // The assembly is still waiting where it was.
    expect(simulation.isTaskPaused).toBe(true)
    expect(world.units[0].stage).toBe("raw")

    expect(simulation.runGameAction("resume")).toBe(true)
    for (
      let elapsedSeconds = 0;
      world.units[0].stage !== "assembled" && elapsedSeconds < 300;
      elapsedSeconds += 0.05
    )
      simulation.step(0.05)
    const unit = world.units[0]
    expect(unit.stage).toBe("assembled")
    expect(
      unit.longScrews.every((screw) => screw.parent === unit.motor.group),
    ).toBe(true)
    expect(screwdriver.parent).toBe(world.tables.assembly_bench)
  },
  { timeout: 120_000 },
)

test(
  "during a simulated batch, Collect labels waits for the current unit instead of stopping the batch",
  () => {
    const simulation = new ManufacturingSimulation()
    const { ctx } = simulation
    simulation.startScenario("run_batch")
    simulation.step(1)
    simulation.printLabelsNow()
    simulation.startScenario("collect_labels")
    expect(ctx.progress.pendingSideJob?.label).toContain("label sheets")
    for (
      let elapsedSeconds = 0;
      ctx.world.labelPrinter.printedSheets.length > 0 && elapsedSeconds < 900;
      elapsedSeconds += 0.05
    )
      simulation.step(0.05)
    expect(ctx.world.labelPrinter.printedSheets.length).toBe(0)
    expect(ctx.world.units[0].stage).toBe("assembled")
    expect(simulation.isTaskRunning).toBe(true)
  },
  { timeout: 120_000 },
)

test(
  "carrying the rack, tote and carton: upright, each hand on its own side",
  () => {
    const simulation = new ManufacturingSimulation()
    const { ctx } = simulation
    simulation.setJobUnitCount(1)
    simulation.startScenario("run_batch")
    let carrySamples = 0
    for (
      let elapsedSeconds = 0;
      elapsedSeconds < 1500 && simulation.isTaskRunning;
      elapsedSeconds += 0.05
    ) {
      simulation.step(0.05)
      const { operator } = ctx
      if (!operator.isCarryingLoad || operator.walkSpeedMps < 0.5) continue
      carrySamples++
      expect(operator.hipBendRadians).toBeLessThan(0.05)
      const leftX = operator.group.worldToLocal(
        operator.leftHand.hand.getWorldPosition(new Vector3()),
      ).x
      const rightX = operator.group.worldToLocal(
        operator.rightHand.hand.getWorldPosition(new Vector3()),
      ).x
      expect(leftX).toBeGreaterThan(rightX)
    }
    expect(carrySamples).toBeGreaterThan(20)
  },
  { timeout: 60_000 },
)

test(
  "paused mid-assembly, the label-printer circle takes the printed sheets to pack-out now",
  () => {
    const simulation = new ManufacturingSimulation()
    simulation.setMode("game")
    const { ctx } = simulation
    const { world } = ctx
    standAt({ simulation, station: STATIONS.assembly })
    simulation.runGameAction("bench")
    for (
      let elapsedSeconds = 0;
      !ctx.statusText.includes("spacer") && elapsedSeconds < 300;
      elapsedSeconds += 0.05
    )
      simulation.step(0.05)
    simulation.runGameAction("bench")
    simulation.printLabelsNow()
    const labelsBefore = countLabelsAtPackOut(world)
    standAt({ simulation, station: STATIONS.labelPrinter })
    simulation.step(0.05)
    expect(simulation.getGameActions().sideJobAction?.label).toContain(
      "label sheets to pack-out",
    )
    simulation.runGameAction("bench")
    for (
      let elapsedSeconds = 0;
      simulation.isSideTaskRunning && elapsedSeconds < 300;
      elapsedSeconds += 0.05
    )
      simulation.step(0.05)
    expect(countLabelsAtPackOut(world)).toBeGreaterThan(labelsBefore)
    expect(simulation.isTaskPaused).toBe(true)
    // Off the circles, E carries on just like C.
    expect(simulation.runGameAction("bench")).toBe(true)
    expect(simulation.isTaskPaused).toBe(false)
  },
  { timeout: 120_000 },
)
