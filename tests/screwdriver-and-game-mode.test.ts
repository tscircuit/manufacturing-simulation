import { expect, test } from "bun:test"
import { Box3, Vector3 } from "three"
import { ASSEMBLY_JOB_STEPS } from "lib/job/assembly-job-steps"
import { getStationStandPose } from "lib/layout/get-station-stand-pose"
import { STATIONS } from "lib/layout/station-layout"
import { MAILER_BOX } from "lib/models/mailer-box"
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

  const printerPose = getStationStandPose(STATIONS.printer)
  operator.position.set(printerPose.x + 0.3, 0, printerPose.z)
  simulation.setWalkInput({ forward: 0, right: 0, cameraCcwYawRadians: 0 })
  expect(simulation.getGameActions().stepAction?.label).toBe(
    "Take spacer print out of the P2S",
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

test("game mode cuts mailer-sized foam and brings both inserts to pack-out", () => {
  const simulation = new ManufacturingSimulation()
  simulation.startScenario("assemble_and_pack")
  const { world, operator, progress } = simulation.ctx
  expect(world.foamCutting.uncutSheet.visible).toBe(true)
  expect(world.foamCutting.cutSheet.visible).toBe(false)
  for (const foam of [world.bottomFoam, world.topFoam]) {
    expect(foam.parent).toBeNull()
    const size = new Box3().setFromObject(foam).getSize(new Vector3())
    expect(size.x).toBeCloseTo(
      MAILER_BOX.lengthM - 2 * MAILER_BOX.boardThicknessM,
      6,
    )
    expect(size.z).toBeCloseTo(
      MAILER_BOX.widthM - 2 * MAILER_BOX.boardThicknessM,
      6,
    )
  }

  const cutStepIndex = ASSEMBLY_JOB_STEPS.findIndex(
    (step) => step.station === STATIONS.foamCutting,
  )
  for (
    let frame = 0;
    frame < 7500 && progress.completedStepCount < cutStepIndex;
    frame++
  ) {
    simulation.step(0.02)
  }
  expect(progress.completedStepCount).toBe(cutStepIndex)
  simulation.setMode("game")
  const packOutPose = getStationStandPose(STATIONS.packOut)
  operator.position.set(packOutPose.x, 0, packOutPose.z)
  expect(simulation.runGameAction("step")).toBe(false)

  const cutterPose = getStationStandPose(STATIONS.foamCutting)
  operator.position.set(cutterPose.x, 0, cutterPose.z)
  expect(simulation.getGameActions().stepAction?.label).toBe(
    "Cut foam to fit the mailer",
  )
  expect(simulation.runGameAction("step")).toBe(true)
  simulation.runUntilIdle({ dtSeconds: 0.02, maxSeconds: 60 })
  expect(operator.leftHand.heldObject).toBe(world.foamInsertPair)
  expect(operator.rightHand.heldObject).toBe(world.motor.group)
  expect(world.foamInsertPair.children).toEqual([
    world.bottomFoam,
    world.topFoam,
  ])

  operator.position.set(packOutPose.x, 0, packOutPose.z)
  expect(simulation.runGameAction("step")).toBe(true)
  simulation.runUntilIdle({ dtSeconds: 0.02, maxSeconds: 60 })
  expect(world.foamInsertPair.parent).toBe(world.tables.pack_out_bench)
  expect(operator.leftHand.heldObject).toBeNull()
  expect(operator.rightHand.heldObject).toBeNull()

  simulation.reset()
  expect(simulation.ctx.world.foamCutting.uncutSheet.visible).toBe(true)
  expect(simulation.ctx.world.foamCutting.cutSheet.visible).toBe(false)
  expect(simulation.ctx.world.foamInsertPair.parent).toBeNull()
})
