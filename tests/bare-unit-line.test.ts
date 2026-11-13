import { expect, test } from "bun:test"
import { getOccupants } from "lib/job/container-slots"
import { getStationStandPose } from "lib/layout/get-station-stand-pose"
import { STATIONS, type Station } from "lib/layout/station-layout"
import { ESD_BAG } from "lib/models/esd-bag"
import { PART_KIT, SCREW_POUCH } from "lib/models/part-kit"
import { BAG_SHIPPING_CARTON } from "lib/models/shipping-carton"
import { ManufacturingSimulation } from "lib/simulation/manufacturing-simulation"
import { METERS_PER_INCH } from "lib/units"

/** Board, spacer, 4 screws, cable, two bags. */
const BAGGED_KIT_KG = 0.03
const CARTON_KG = 0.5
/** The cable's coil is about 46 mm across. */
const CABLE_COIL_M = 0.046
const BOARD_LENGTH_M = 0.0423
/** A reclosable bag's zip sits about half an inch below the top edge. */
const ZIP_ALLOWANCE_M = 0.013

test("the kit fits a 3 x 5 in bag snugly, and the bag and carton meet Amazon's limits", () => {
  // Contents side by side: the board pile, and the cable under the screw pouch.
  const contentsWidthM = Math.max(SCREW_POUCH.widthM, BOARD_LENGTH_M + 0.0013)
  const contentsLengthM =
    BOARD_LENGTH_M + Math.max(CABLE_COIL_M, SCREW_POUCH.foldedLengthM) + 0.003
  const thicknessM = PART_KIT.boardPileThicknessM
  const neededWidthM = contentsWidthM + thicknessM + 0.006
  const neededLengthM =
    contentsLengthM + thicknessM / 2 + ZIP_ALLOWANCE_M + 0.003
  expect(neededWidthM).toBeLessThan(ESD_BAG.widthM)
  expect(neededLengthM).toBeLessThan(ESD_BAG.heightM)
  // Not too big: under 15 mm to spare each way.
  expect(ESD_BAG.widthM - neededWidthM).toBeLessThan(0.015)
  expect(ESD_BAG.heightM - neededLengthM).toBeLessThan(0.015)
  // Openings of 5" or more need a printed suffocation warning; both bags stay under it.
  expect(ESD_BAG.widthM).toBeLessThan(5 * METERS_PER_INCH)
  expect(SCREW_POUCH.widthM).toBeLessThan(5 * METERS_PER_INCH)

  const c = BAG_SHIPPING_CARTON
  for (const sideM of [c.innerLengthM, c.innerWidthM, c.innerHeightM])
    expect(sideM + 2 * c.boardThicknessM).toBeLessThan(25 * METERS_PER_INCH)
  const units = c.columns * c.rows * c.layers
  expect(units).toBe(30)
  expect((units * BAGGED_KIT_KG + CARTON_KG) * 2.20462).toBeLessThan(50)
  expect(c.columns * c.itemPitchXM).toBeLessThanOrEqual(c.innerLengthM)
  expect(c.rows * c.itemPitchZM).toBeLessThanOrEqual(c.innerWidthM)
  expect(c.itemHeightM).toBeLessThan(c.innerHeightM)
})

test("the full kit line has no bags, kits, FNSKU sheets, box ID label or test motor", () => {
  const { world } = new ManufacturingSimulation().ctx
  expect(world.productLine).toBe("kit")
  expect(
    world.units.every((unit) => unit.bag === null && unit.kit === null),
  ).toBe(true)
  expect(world.fnskuSheets).toHaveLength(0)
  expect(world.boxIdLabel).toBeNull()
  expect(world.testMotor).toBeNull()
})

test("the bare-unit line has no motors to assemble, and one test motor at QC", () => {
  const { world } = new ManufacturingSimulation({ productLine: "bagged" }).ctx
  expect(world.units.every((unit) => unit.motor.group.parent === null)).toBe(
    true,
  )
  expect(world.motorFoamStand.group.visible).toBe(false)
  expect(world.testMotor?.group.parent).toBe(world.tables.qc_bench)
})

test(
  "a bagged batch of 30: board, spacer, screw pouch and cable in every bag, 30 in one labelled carton",
  () => {
    const simulation = new ManufacturingSimulation({ productLine: "bagged" })
    simulation.startScenario("run_batch")
    simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 6000 })
    const { world, progress } = simulation.ctx
    expect(progress.isJobComplete).toBe(true)
    for (const unit of world.units) {
      const { bag, kit } = unit
      if (!bag || !kit)
        throw new Error("Every unit is kitted and bagged on this line")
      expect(unit.stage).toBe("shipped")
      expect(kit.group.parent).toBe(bag.group)
      expect(unit.pcb.group.parent).toBe(kit.group)
      expect(unit.spacer?.parent).toBe(kit.group)
      expect(kit.cable?.parent).toBe(kit.group)
      expect(kit.screwPouch.parent).toBe(kit.group)
      expect(unit.longScrews).toHaveLength(4)
      expect(
        unit.longScrews.every((screw) => screw.parent === kit.screwPouch),
      ).toBe(true)
      // In the bag the cable and pouch lie beside the board, not on it.
      expect(
        Math.abs(kit.pcbSpot.position.z - kit.cableSpot.position.z),
      ).toBeGreaterThan(0.04)
      expect(unit.label?.parent).toBe(bag.group)
      expect(unit.fnskuLabel?.parent).toBe(bag.group)
      expect(bag.group.parent).toBe(world.carton.group)
    }
    expect(getOccupants(world.carton)).toHaveLength(30)
    expect(world.boxIdLabel?.visible).toBe(true)
    expect(world.carton.tape.scale.x).toBeCloseTo(1, 5)
  },
  { timeout: 120_000 },
)

test(
  "bagged line, one at a time: kit 2, test both on the test motor, bag and ship a carton of 2",
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
    // The test motor spun for each board and stayed at QC.
    expect(ctx.world.testMotor?.rotor.rotation.y).toBeGreaterThan(
      Math.PI * 2 * 17,
    )
    expect(ctx.world.testMotor?.group.parent).toBe(ctx.world.tables.qc_bench)
  },
  { timeout: 120_000 },
)

test("jumping to ship-ready has 30 bagged kits in the tote", () => {
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
  expect(
    world.units.every((unit) => unit.kit?.group.parent === unit.bag?.group),
  ).toBe(true)
})
