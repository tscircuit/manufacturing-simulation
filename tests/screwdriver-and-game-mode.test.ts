import { expect, test } from "bun:test"
import { Vector3 } from "three"
import { getStationStandPose } from "lib/layout/get-station-stand-pose"
import { STATIONS } from "lib/layout/station-layout"
import { ManufacturingSimulation } from "lib/simulation/manufacturing-simulation"

test("pick up the screwdriver scenario ends with it in the right hand", () => {
  const simulation = new ManufacturingSimulation()
  simulation.startScenario("pick_up_screwdriver")
  simulation.runUntilIdle({ dtSeconds: 0.02, maxSeconds: 60 })
  const { operator, world, progress } = simulation.ctx
  expect(progress.isHoldingLooseScrewdriver).toBe(true)
  expect(operator.rightHand.heldObject).toBe(world.screwdriver.group)
  expect(world.screwdriver.group.parent).toBe(operator.rightHand.hand)
})

test("game mode walks with input and offers the next step near its station", () => {
  const simulation = new ManufacturingSimulation()
  simulation.setMode("game")
  const { operator } = simulation.ctx
  const start = operator.position.clone()
  simulation.setWalkInput({
    forward: 1,
    right: 0,
    cameraCcwYawRadians: Math.PI,
  })
  for (let frame = 0; frame < 60; frame++) simulation.step(1 / 60)
  expect(operator.position.distanceTo(start)).toBeGreaterThan(1)
  expect(simulation.getGameActions().stepAction).toBeNull()

  const spacerPose = getStationStandPose(STATIONS.spacers)
  operator.position.set(spacerPose.x + 0.3, 0, spacerPose.z)
  simulation.setWalkInput({ forward: 0, right: 0, cameraCcwYawRadians: 0 })
  expect(simulation.getGameActions().stepAction?.label).toBe(
    "Take a spacer from the basket",
  )
  expect(simulation.runGameAction("step")).toBe(true)
  simulation.runUntilIdle({ dtSeconds: 0.02, maxSeconds: 60 })
  expect(simulation.ctx.progress.completedStepCount).toBe(1)
  expect(simulation.ctx.world.spacer.parent).toBe(
    simulation.ctx.world.tables.assembly_bench,
  )

  const assemblyPose = getStationStandPose(STATIONS.assembly)
  operator.position.set(assemblyPose.x, 0, assemblyPose.z)
  const actions = simulation.getGameActions()
  expect(actions.stepAction?.label).toBe("Load a motor in the jig")
  expect(actions.benchAction?.label).toBe(
    "Run the rest of the Assembly bench (7 steps)",
  )
})

test("C runs the rest of the assembly bench, and E pauses and resumes it in place", () => {
  const simulation = new ManufacturingSimulation()
  simulation.setMode("game")
  const { operator, progress, world } = simulation.ctx
  const pose = getStationStandPose(STATIONS.assembly)
  operator.position.set(pose.x, 0, pose.z)
  expect(simulation.runGameAction("bench")).toBe(true)

  // Run into the stock-screw removal, then pause there.
  for (let frame = 0; frame < 2000 && progress.completedStepCount < 2; frame++)
    simulation.step(0.02)
  for (let frame = 0; frame < 150; frame++) simulation.step(0.02)
  expect(progress.activeStepIndex).toBe(2)
  expect(simulation.runGameAction("step")).toBe(true)
  expect(simulation.isTaskPaused).toBe(true)
  expect(simulation.getGameActions().pauseLabel).toBe("Resume")

  const screwdriverPosition = world.screwdriver.group.getWorldPosition(
    new Vector3(),
  )
  const cycleSeconds = progress.cycleSeconds
  for (let frame = 0; frame < 200; frame++) simulation.step(0.02)
  expect(
    world.screwdriver.group
      .getWorldPosition(new Vector3())
      .distanceTo(screwdriverPosition),
  ).toBeLessThan(1e-9)
  expect(progress.cycleSeconds).toBe(cycleSeconds)
  expect(progress.activeStepIndex).toBe(2)

  simulation.runGameAction("step")
  expect(simulation.isTaskPaused).toBe(false)
  simulation.runUntilIdle({ dtSeconds: 0.02, maxSeconds: 200 })
  // Stops at the end of the assembly bench, holding the finished assembly.
  expect(progress.completedStepCount).toBe(8)
  expect(operator.rightHand.heldObject).toBe(world.motor.group)
  expect(world.motorCable.boardPlug.group.parent).toBe(world.pcb.group)
})
