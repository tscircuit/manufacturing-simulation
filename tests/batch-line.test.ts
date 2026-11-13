import { expect, test } from "bun:test"
import { JOB_ROWS } from "lib/job/job-plan"
import { BATCH_SIZE, OUTBOUND_SPOT } from "lib/layout/station-layout"
import { SHIPPING_CARTON_CAPACITY } from "lib/models/shipping-carton"
import { ManufacturingSimulation } from "lib/simulation/manufacturing-simulation"
import { Box3, Vector3 } from "three"

test(
  "a batch of 30 runs bench to bench and ships in one sealed Amazon carton",
  () => {
    const simulation = new ManufacturingSimulation()
    simulation.startScenario("run_batch")
    simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 6000 })
    const { progress, world, operator } = simulation.ctx

    expect(simulation.isTaskRunning).toBe(false)
    expect(progress.isJobComplete).toBe(true)
    expect(world.units.every((unit) => unit.stage === "shipped")).toBe(true)
    for (const row of JOB_ROWS) {
      if (row.runCount === null) continue
      expect(progress.rowCompletedCounts[row.rowIndex]).toBe(row.runCount)
      expect(progress.rowSeconds[row.rowIndex]).toBeGreaterThan(0.5)
    }

    // Every unit: spacer, PCB, four long screws and a cable plugged at both ends, packed and labelled.
    for (const unit of world.units) {
      const motor = unit.motor.group
      expect(unit.spacer?.parent).toBe(motor)
      expect(unit.pcb.group.parent).toBe(motor)
      expect(unit.longScrews.every((screw) => screw.parent === motor)).toBe(
        true,
      )
      expect(unit.motorCable?.motorPlug.group.parent).toBe(motor)
      expect(unit.motorCable?.boardPlug.group.parent).toBe(unit.pcb.group)
      expect(motor.parent).toBe(unit.box.group)
      expect(unit.label?.parent).toBe(unit.box.lid)
      expect(unit.box.group.parent).toBe(world.carton.group)
      const boxBounds = new Box3()
        .setFromObject(unit.box.group)
        .expandByScalar(0.003)
      expect(
        boxBounds.containsPoint(motor.getWorldPosition(new Vector3())),
      ).toBe(true)
    }
    expect(world.removedStockScrews).toHaveLength(4 * BATCH_SIZE)
    expect(
      world.removedStockScrews.every(
        (screw) => screw.parent === world.usedScrewBin,
      ),
    ).toBe(true)

    // The carton holds the whole batch, is sealed, and waits by the door.
    expect(BATCH_SIZE).toBe(SHIPPING_CARTON_CAPACITY)
    expect(world.carton.tape.scale.x).toBeCloseTo(1, 5)
    expect(world.carton.frontFlap.rotation.x).toBeCloseTo(0, 5)
    expect(world.carton.group.parent).toBe(world.root)
    expect(world.carton.group.position.x).toBeCloseTo(OUTBOUND_SPOT.xM, 5)
    expect(world.carton.group.position.y).toBeCloseTo(0, 5)

    // Racks and tote ended up where the line put them; hands are empty.
    expect(world.finishedRack.group.parent).toBe(world.tables.qc_bench)
    expect(world.readyRack.group.parent).toBe(world.tables.pack_out_bench)
    expect(world.packingTote.group.parent).toBe(world.tables.ship_ready_bench)
    expect(world.screwdriver.group.parent).toBe(world.tables.assembly_bench)
    expect(operator.leftHand.heldObject).toBeNull()
    expect(operator.rightHand.heldObject).toBeNull()
  },
  { timeout: 120_000 },
)

test("the same run is deterministic", () => {
  const cycleTimes = [0, 1].map(() => {
    const simulation = new ManufacturingSimulation()
    simulation.startScenario("run_batch")
    simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 120 })
    return [
      simulation.ctx.progress.rowCompletedCounts,
      simulation.ctx.progress.cycleSeconds,
    ]
  })
  expect(cycleTimes[0]).toEqual(cycleTimes[1])
})
