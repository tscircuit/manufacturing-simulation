import { expect, test } from "bun:test"
import { Box3, Vector3 } from "three"
import { ASSEMBLY_JOB_STEPS } from "lib/job/assembly-job-steps"
import { ManufacturingSimulation } from "lib/simulation/manufacturing-simulation"
import { PACK_OUT_BENCH_SPOTS } from "lib/world/bench-spots"

function isDescendantOf(params: {
  child: { parent: unknown }
  ancestor: unknown
}): boolean {
  let node = params.child.parent as { parent: unknown } | null
  while (node) {
    if (node === params.ancestor) return true
    node = node.parent as { parent: unknown } | null
  }
  return false
}

test("assemble-and-pack runs every step and ends with the box on finished goods", () => {
  const simulation = new ManufacturingSimulation()
  simulation.startScenario("assemble_and_pack")
  simulation.runUntilIdle({ dtSeconds: 0.02, maxSeconds: 300 })

  const { progress, world } = simulation.ctx
  expect(simulation.isTaskRunning).toBe(false)
  expect(progress.isJobComplete).toBe(true)
  expect(progress.completedStepCount).toBe(ASSEMBLY_JOB_STEPS.length)
  expect(ASSEMBLY_JOB_STEPS).toHaveLength(12)
  for (const stepSeconds of progress.stepSeconds)
    expect(stepSeconds).toBeGreaterThan(0.5)
  const stepTotalSeconds = progress.stepSeconds.reduce(
    (sum, seconds) => sum + seconds,
    0,
  )
  expect(progress.cycleSeconds).toBeGreaterThan(stepTotalSeconds)
  expect(progress.cycleSeconds).toBeLessThan(150)

  // The assembly is spacer + PCB + 4 screws on the motor, packed in foam in the box.
  const motor = world.motor.group
  expect(world.spacer.parent).toBe(motor)
  expect(world.pcb.parent).toBe(motor)
  expect(
    motor.children.filter((child) =>
      world.motor.backfaceScrews.some((screw) => screw.group === child),
    ),
  ).toHaveLength(4)
  expect(world.screwsInDish).toHaveLength(0)
  expect(isDescendantOf({ child: motor, ancestor: world.box.group })).toBe(true)
  expect(world.bottomFoam.parent).toBe(world.box.group)
  expect(world.topFoam.parent).toBe(world.box.group)

  const packOutBench = world.tables.pack_out_bench
  expect(world.box.group.parent).toBe(packOutBench)
  expect(
    world.box.group.position.distanceTo(PACK_OUT_BENCH_SPOTS.finishedGoods),
  ).toBeLessThan(1e-6)
  expect(world.box.lid.rotation.z).toBeCloseTo(Math.PI / 2, 5)

  // The motor stays inside the closed box.
  const boxBounds = new Box3()
    .setFromObject(world.box.group)
    .expandByScalar(0.002)
  expect(boxBounds.containsPoint(motor.getWorldPosition(new Vector3()))).toBe(
    true,
  )

  // The screwdriver is back where it started and both hands are free.
  expect(world.screwdriver.group.parent).toBe(world.tables.assembly_bench)
  expect(simulation.ctx.operator.leftHand.heldObject).toBeNull()
  expect(simulation.ctx.operator.rightHand.heldObject).toBeNull()
})

test("same run is deterministic", () => {
  const cycleTimes = [0, 1].map(() => {
    const simulation = new ManufacturingSimulation()
    simulation.startScenario("assemble_and_pack")
    simulation.runUntilIdle({ dtSeconds: 0.02, maxSeconds: 300 })
    return simulation.ctx.progress.cycleSeconds
  })
  expect(cycleTimes[0]).toBe(cycleTimes[1])
})
