import { expect, test } from "bun:test"
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
    "Pick a spacer from the basket",
  )
  expect(simulation.runGameAction("step")).toBe(true)
  simulation.runUntilIdle({ dtSeconds: 0.02, maxSeconds: 60 })
  expect(simulation.ctx.progress.completedStepCount).toBe(1)
  expect(operator.rightHand.heldObject).toBe(simulation.ctx.world.spacer)

  const assemblyPose = getStationStandPose(STATIONS.assembly)
  operator.position.set(assemblyPose.x, 0, assemblyPose.z)
  const actions = simulation.getGameActions()
  expect(actions.stepAction?.label).toBe("Set spacer down, load motor in jig")
  // Hands are full, so the screwdriver can't be picked up.
  expect(actions.screwdriverAction).toBeNull()
})
