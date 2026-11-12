import { expect, test } from "bun:test"
import { Vector3 } from "three"
import { getStationStandPose } from "lib/layout/get-station-stand-pose"
import { STATIONS } from "lib/layout/station-layout"
import { ManufacturingSimulation } from "lib/simulation/manufacturing-simulation"

function standAt(params: {
  simulation: ManufacturingSimulation
  station: typeof STATIONS.assembly
}): void {
  const pose = getStationStandPose(params.station)
  params.simulation.ctx.operator.position.set(pose.x, 0, pose.z)
  params.simulation.ctx.operator.ccwYawRadians = pose.ccwYawRadians
}

function stepUntil(params: {
  simulation: ManufacturingSimulation
  isDone: () => boolean
  maxSeconds: number
}): void {
  for (
    let elapsedSeconds = 0;
    !params.isDone() && elapsedSeconds < params.maxSeconds;
    elapsedSeconds += 0.02
  ) {
    params.simulation.step(0.02)
  }
}

test("reset clears everything mid-task: nothing is left floating or in the operator's hands", () => {
  const simulation = new ManufacturingSimulation()
  const handChildCounts = simulation.ctx.operator.hands.map(
    (hand) => hand.hand.children.length,
  )
  const sceneChildren = [...simulation.ctx.scene.children]
  simulation.startScenario("run_batch")
  // Stop mid-unscrew, with the screwdriver and a screw in the air.
  stepUntil({
    simulation,
    isDone: () => simulation.ctx.statusText.includes("removing stock screw 3"),
    maxSeconds: 120,
  })
  simulation.setTaskPaused(true)
  simulation.reset()

  const { ctx } = simulation
  expect(
    ctx.scene.children.filter((child) => !sceneChildren.includes(child)),
  ).toEqual([ctx.world.root])
  expect(ctx.scene.children).toHaveLength(sceneChildren.length)
  // The fresh world's root holds only benches and the QC cables' wires.
  for (const child of ctx.world.root.children) {
    const isTable = Object.values(ctx.world.tables).includes(child as never)
    const isWire = ctx.world.cables.some((cable) => cable.wire === child)
    expect(isTable || isWire).toBe(true)
  }
  expect(ctx.operator.hands.map((hand) => hand.hand.children.length)).toEqual(
    handChildCounts,
  )
  expect(ctx.world.screwdriver.group.parent).toBe(
    ctx.world.tables.assembly_bench,
  )
})

test("E runs the whole assembly bench; E pauses it, the player can walk away, and E resumes where it stopped", () => {
  const simulation = new ManufacturingSimulation()
  simulation.setMode("game")
  const { ctx } = simulation
  standAt({ simulation, station: STATIONS.assembly })
  expect(simulation.getGameActions().benchAction?.label).toBe(
    "Run the Assembly bench (211 steps left)",
  )
  expect(simulation.runGameAction("bench")).toBe(true)

  // Into unit 1's stock-screw removal, then pause.
  stepUntil({
    simulation,
    isDone: () => ctx.statusText.includes("removing stock screw 2"),
    maxSeconds: 120,
  })
  expect(simulation.runGameAction("bench")).toBe(true)
  expect(simulation.isTaskPaused).toBe(true)
  expect(simulation.getGameActions().pauseLabel).toBe("Resume")

  const screwdriverPosition = ctx.world.screwdriver.group.getWorldPosition(
    new Vector3(),
  )
  const cycleSeconds = ctx.progress.cycleSeconds
  const pausedAt = ctx.operator.position.clone()
  simulation.setWalkInput({ forward: 0, right: 1, cameraCcwYawRadians: 0 })
  for (let frame = 0; frame < 60; frame++) simulation.step(1 / 60)
  simulation.setWalkInput({ forward: 0, right: 0, cameraCcwYawRadians: 0 })
  expect(ctx.operator.position.distanceTo(pausedAt)).toBeGreaterThan(0.5)
  expect(
    ctx.world.screwdriver.group
      .getWorldPosition(new Vector3())
      .distanceTo(screwdriverPosition),
  ).toBeLessThan(1e-9)
  expect(ctx.progress.cycleSeconds).toBe(cycleSeconds)

  simulation.runGameAction("bench")
  expect(simulation.isTaskPaused).toBe(false)
  // Walks back, finishes unit 1 without any more key presses, and carries on to unit 2.
  stepUntil({
    simulation,
    isDone: () => ctx.progress.completedWorkCount >= 8,
    maxSeconds: 200,
  })
  const unit = ctx.world.units[0]
  expect(unit.motor.group.parent).toBe(ctx.world.finishedRack.group)
  expect(unit.spacer?.parent).toBe(unit.motor.group)
  expect(
    unit.longScrews.every((screw) => screw.parent === unit.motor.group),
  ).toBe(true)
  expect(simulation.isTaskRunning).toBe(true)
})

test("collecting the printer plates refills the spacer basket and restarts both prints", () => {
  const simulation = new ManufacturingSimulation()
  const { world } = simulation.ctx
  const startingSpacers = world.spacerStock.length
  const platedSpacers = world.printers.reduce(
    (sum, printer) => sum + printer.plateSpacers.length,
    0,
  )
  expect(world.printers.map((printer) => printer.plateSpacers.length)).toEqual([
    25, 49,
  ])
  simulation.startScenario("refill_spacers")
  simulation.runUntilIdle({ dtSeconds: 0.02, maxSeconds: 300 })
  expect(world.spacerStock).toHaveLength(startingSpacers + platedSpacers)
  expect(
    world.spacerStock.every((spacer) => spacer.parent === world.spacerBasket),
  ).toBe(true)
  expect(
    world.printers.every(
      (printer) => printer.isPrinting && printer.plateSpacers.length === 0,
    ),
  ).toBe(true)
  expect(world.carriedTub).toBeNull()
  expect(world.usedTubs).toHaveLength(1)
  expect(world.usedTubs[0].parent).toBe(world.tables.assembly_bench)
})

test("the screwdriver can be picked up and put back in game mode", () => {
  const simulation = new ManufacturingSimulation()
  simulation.setMode("game")
  standAt({ simulation, station: STATIONS.assembly })
  expect(simulation.runGameAction("screwdriver")).toBe(true)
  simulation.runUntilIdle({ dtSeconds: 0.02, maxSeconds: 60 })
  const { world, operator, progress } = simulation.ctx
  expect(progress.isHoldingLooseScrewdriver).toBe(true)
  expect(operator.rightHand.heldObject).toBe(world.screwdriver.group)
  expect(simulation.runGameAction("screwdriver")).toBe(true)
  simulation.runUntilIdle({ dtSeconds: 0.02, maxSeconds: 60 })
  expect(world.screwdriver.group.parent).toBe(world.tables.assembly_bench)
})
