import { expect, test } from "bun:test"
import { Box3, type Object3D, Vector3 } from "three"
import { ASSEMBLY_JOB_STEPS } from "lib/job/assembly-job-steps"
import {
  LONG_SCREW_SHANK_M,
  STOCK_SCREW_SHANK_M,
} from "lib/models/nema17-motor"
import { ManufacturingSimulation } from "lib/simulation/manufacturing-simulation"
import { QC_BENCH_SPOTS, SHIP_READY_BENCH_SPOTS } from "lib/world/bench-spots"

function isDescendantOf(params: {
  child: Object3D
  ancestor: Object3D
}): boolean {
  for (let node = params.child.parent; node; node = node.parent) {
    if (node === params.ancestor) return true
  }
  return false
}

function runFullJob(): ManufacturingSimulation {
  const simulation = new ManufacturingSimulation()
  simulation.startScenario("assemble_and_pack")
  simulation.runUntilIdle({ dtSeconds: 0.02, maxSeconds: 400 })
  return simulation
}

test("the line job runs all 15 steps and leaves a labelled box on ship-ready", () => {
  const simulation = runFullJob()
  const { progress, world, operator } = simulation.ctx
  expect(simulation.isTaskRunning).toBe(false)
  expect(ASSEMBLY_JOB_STEPS).toHaveLength(15)
  expect(progress.isJobComplete).toBe(true)
  expect(progress.completedStepCount).toBe(15)
  for (const stepSeconds of progress.stepSeconds)
    expect(stepSeconds).toBeGreaterThan(0.5)
  const stepTotalSeconds = progress.stepSeconds.reduce(
    (sum, seconds) => sum + seconds,
    0,
  )
  expect(progress.cycleSeconds).toBeGreaterThan(stepTotalSeconds)
  expect(progress.cycleSeconds).toBeLessThan(240)

  // Spacer and PCB on the motor, held by four long screws.
  const motor = world.motor.group
  expect(world.spacer.parent).toBe(motor)
  expect(world.pcb.group.parent).toBe(motor)
  expect(world.longScrews.every((screw) => screw.parent === motor)).toBe(true)

  // The four stock screws ended up in the used-screw bin, not on the motor.
  expect(world.removedStockScrews).toHaveLength(4)
  expect(
    world.removedStockScrews.every(
      (screw) => screw.parent === world.usedScrewBin,
    ),
  ).toBe(true)
  expect(STOCK_SCREW_SHANK_M).toBeLessThan(LONG_SCREW_SHANK_M)

  // The motor cable stays plugged in at both ends.
  expect(world.motorCable.motorPlug.group.parent).toBe(motor)
  expect(world.motorCable.boardPlug.group.parent).toBe(world.pcb.group)

  // The QC cables are back on the QC bench and the test passed.
  const qcBench = world.tables.qc_bench
  expect(world.qcDataCable.plug.group.parent).toBe(qcBench)
  expect(
    world.qcPowerCable.plug.group.position.distanceTo(
      QC_BENCH_SPOTS.powerPlugRest,
    ),
  ).toBeLessThan(1e-6)
  expect(world.motor.rotor.rotation.y).toBeGreaterThan(Math.PI * 2)

  // Box: motor, two USB-C cables and the charger inside, lid closed, label on the lid.
  const { box } = world
  expect(isDescendantOf({ child: motor, ancestor: box.group })).toBe(true)
  for (const coil of world.packedUsbCables) expect(coil.parent).toBe(box.group)
  expect(world.packedCharger.parent).toBe(box.group)
  expect(box.lid.rotation.x).toBeCloseTo(0, 5)
  expect(world.sticker.parent).toBe(box.lid)
  const boxBounds = new Box3().setFromObject(box.group).expandByScalar(0.002)
  expect(boxBounds.containsPoint(motor.getWorldPosition(new Vector3()))).toBe(
    true,
  )

  expect(box.group.parent).toBe(world.tables.ship_ready_bench)
  expect(
    box.group.position.distanceTo(SHIP_READY_BENCH_SPOTS.outgoing),
  ).toBeLessThan(1e-6)
  expect(world.screwdriver.group.parent).toBe(world.tables.assembly_bench)
  expect(operator.leftHand.heldObject).toBeNull()
  expect(operator.rightHand.heldObject).toBeNull()
})

test("the same run is deterministic", () => {
  const [first, second] = [runFullJob(), runFullJob()]
  expect(first.ctx.progress.cycleSeconds).toBe(second.ctx.progress.cycleSeconds)
})
