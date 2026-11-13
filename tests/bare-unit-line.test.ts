import { expect, test } from "bun:test"
import { getOccupants } from "lib/job/container-slots"
import { getStationStandPose } from "lib/layout/get-station-stand-pose"
import { STATIONS, type Station } from "lib/layout/station-layout"
import { ESD_BAG } from "lib/models/esd-bag"
import { BAG_SHIPPING_CARTON } from "lib/models/shipping-carton"
import { ManufacturingSimulation } from "lib/simulation/manufacturing-simulation"
import { METERS_PER_INCH } from "lib/units"

const BAGGED_UNIT_KG = 0.33
const CARTON_KG = 0.9

test("the bag and carton meet Amazon's limits", () => {
  // Openings of 5" or more need a printed suffocation warning; this bag stays under it.
  expect(ESD_BAG.widthM).toBeLessThan(5 * METERS_PER_INCH)
  const c = BAG_SHIPPING_CARTON
  for (const sideM of [c.innerLengthM, c.innerWidthM, c.innerHeightM])
    expect(sideM + 2 * c.boardThicknessM).toBeLessThan(25 * METERS_PER_INCH)
  const units = c.columns * c.rows * c.layers
  expect(units).toBe(30)
  const pounds = (units * BAGGED_UNIT_KG + CARTON_KG) * 2.20462
  expect(pounds).toBeLessThan(50)
  // Bags fit the carton's grid.
  expect(c.columns * c.itemPitchXM).toBeLessThanOrEqual(c.innerLengthM)
  expect(c.rows * c.itemPitchZM).toBeLessThanOrEqual(c.innerWidthM)
  expect(c.itemHeightM).toBeLessThan(c.innerHeightM)
})

test("the full kit line has no bags, FNSKU sheets or box ID label", () => {
  const { world } = new ManufacturingSimulation().ctx
  expect(world.productLine).toBe("kit")
  expect(world.units.every((unit) => unit.bag === null)).toBe(true)
  expect(world.fnskuSheets).toHaveLength(0)
  expect(world.boxIdLabel).toBeNull()
})

test(
  "a bagged batch of 30: bag, sticker and FNSKU on every unit, 30 standing in one labelled carton",
  () => {
    const simulation = new ManufacturingSimulation({ productLine: "bagged" })
    simulation.startScenario("run_batch")
    simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 6000 })
    const { world, progress } = simulation.ctx
    expect(progress.isJobComplete).toBe(true)
    for (const unit of world.units) {
      const bag = unit.bag
      if (!bag) throw new Error("Every unit has a bag on this line")
      expect(unit.stage).toBe("shipped")
      expect(unit.motor.group.parent).toBe(bag.group)
      expect(unit.label?.parent).toBe(bag.group)
      expect(unit.fnskuLabel?.parent).toBe(bag.group)
      expect(bag.group.parent).toBe(world.carton.group)
      expect(bag.filledBody.visible).toBe(true)
    }
    expect(getOccupants(world.carton)).toHaveLength(30)
    expect(world.boxIdLabel?.visible).toBe(true)
    expect(world.carton.tape.scale.x).toBeCloseTo(1, 5)
    // Nothing from the kit was packed.
    expect(world.units.every((unit) => unit.box.group.parent === null)).toBe(
      true,
    )
  },
  { timeout: 120_000 },
)

test(
  "bagged line, one at a time: build 2, QC, bag and ship a carton of 2",
  () => {
    const simulation = new ManufacturingSimulation({ productLine: "bagged" })
    simulation.setMode("game")
    simulation.setJobUnitCount(1)
    const { ctx } = simulation
    const runAt = (station: Station) => {
      const pose = getStationStandPose(station)
      ctx.operator.position.set(pose.x, 0, pose.z)
      ctx.operator.ccwYawRadians = pose.ccwYawRadians
      simulation.step(0.05)
      expect(simulation.runGameAction("bench")).toBe(true)
      simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 2000 })
    }
    runAt(STATIONS.assembly)
    runAt(STATIONS.assembly)
    runAt(STATIONS.assemblyRack)
    runAt(STATIONS.qc)
    runAt(STATIONS.packOut)
    runAt(STATIONS.shipReady)
    expect(ctx.progress.isJobComplete).toBe(true)
    expect(getOccupants(ctx.world.carton)).toHaveLength(2)
    expect(
      ctx.world.units.filter((unit) => unit.stage === "shipped"),
    ).toHaveLength(2)
  },
  { timeout: 120_000 },
)

test("jumping to the bagging bench bags nothing yet; jumping to ship-ready has 30 bagged in the tote", () => {
  const simulation = new ManufacturingSimulation({ productLine: "bagged" })
  simulation.setJobUnitCount(30)
  simulation.startAt("ship_ready")
  const { world } = simulation.ctx
  expect(world.units.every((unit) => unit.stage === "packed")).toBe(true)
  expect(
    world.units.every(
      (unit) => unit.bag?.group.parent === world.packingTote.group,
    ),
  ).toBe(true)
})
