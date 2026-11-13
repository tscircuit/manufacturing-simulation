import { expect, test } from "bun:test"
import { getOccupants } from "lib/job/container-slots"
import { getStationStandPose } from "lib/layout/get-station-stand-pose"
import {
  BARE_UNIT_TABLE_LAYOUT,
  STATIONS,
  type Station,
  TABLE_PLACEMENTS,
} from "lib/layout/station-layout"
import { ESD_BAG } from "lib/models/esd-bag"
import { PART_KIT } from "lib/models/part-kit"
import { SCREW_POUCH } from "lib/models/screw-pouch"
import { BAG_SHIPPING_CARTON } from "lib/models/shipping-carton"
import { ManufacturingSimulation } from "lib/simulation/manufacturing-simulation"
import { METERS_PER_INCH } from "lib/units"
import { Vector3 } from "three"

/** Board, spacer, 4 screws, cable, two bags. */
const BAGGED_UNIT_KG = 0.025
const CARTON_KG = 0.5
const CABLE_COIL_M = 0.046
const BOARD_LENGTH_M = 0.0423
test("the contents fit the Ellbest 80 x 120 mm bag snugly; bag, pouch and carton meet Amazon's limits", () => {
  // Two piles side by side: the board on its spacer, and the cable under the folded screw pouch.
  const contentsWidthM = Math.max(SCREW_POUCH.widthM, BOARD_LENGTH_M + 0.0013)
  const contentsLengthM =
    BOARD_LENGTH_M + Math.max(CABLE_COIL_M, SCREW_POUCH.foldedLengthM) + 0.003
  const thicknessM = Math.max(
    PART_KIT.boardPileThicknessM,
    PART_KIT.cablePileThicknessM,
  )
  const neededWidthM = contentsWidthM + thicknessM + 0.006
  const neededLengthM =
    contentsLengthM + thicknessM / 2 + ESD_BAG.zipFromTopM + 0.003
  expect(neededWidthM).toBeLessThan(ESD_BAG.widthM)
  expect(neededLengthM).toBeLessThan(ESD_BAG.heightM)
  // Not too big: under 15 mm to spare each way.
  expect(ESD_BAG.widthM - neededWidthM).toBeLessThan(0.015)
  expect(ESD_BAG.heightM - neededLengthM).toBeLessThan(0.015)
  // The original 2" x 4" label only just fits between the bottom seal and the zip.
  const labelRoomM = ESD_BAG.heightM - ESD_BAG.zipFromTopM - ESD_BAG.sealWidthM
  expect(4 * METERS_PER_INCH).toBeLessThan(labelRoomM)
  expect(labelRoomM - 4 * METERS_PER_INCH).toBeLessThan(0.002)
  // Openings of 5" or more need a printed suffocation warning; both bags stay under it.
  expect(ESD_BAG.widthM).toBeLessThan(5 * METERS_PER_INCH)
  expect(SCREW_POUCH.widthM).toBeLessThan(5 * METERS_PER_INCH)

  const c = BAG_SHIPPING_CARTON
  for (const sideM of [c.innerLengthM, c.innerWidthM, c.innerHeightM])
    expect(sideM + 2 * c.boardThicknessM).toBeLessThan(25 * METERS_PER_INCH)
  const units = c.columns * c.rows * c.layers
  expect(units).toBe(30)
  expect((units * BAGGED_UNIT_KG + CARTON_KG) * 2.20462).toBeLessThan(50)
  expect(c.columns * c.itemPitchXM).toBeLessThanOrEqual(c.innerLengthM)
  expect(c.rows * c.itemPitchZM).toBeLessThanOrEqual(c.innerWidthM)
  expect(c.itemHeightM).toBeLessThan(c.innerHeightM)
})

test("the full kit line is unchanged: assembly bench on the floor, no bags or test motor", () => {
  const { world } = new ManufacturingSimulation().ctx
  expect(world.productLine).toBe("kit")
  expect(world.tables.assembly_bench.parent).toBe(world.root)
  expect(
    world.units.every((unit) => unit.bag === null && unit.kit === null),
  ).toBe(true)
  expect(world.fnskuSheets).toHaveLength(0)
  expect(world.boxIdLabel).toBeNull()
  expect(world.testMotor).toBeNull()
})

test("the bare-unit floor: no assembly bench, QC moved up into its place, boards in a tray at QC", () => {
  const { world } = new ManufacturingSimulation({ productLine: "bagged" }).ctx
  expect(world.tables.assembly_bench.parent).toBeNull()
  const qcPlacement = BARE_UNIT_TABLE_LAYOUT.qc_bench
  expect(qcPlacement?.centerZM).toBeCloseTo(
    TABLE_PLACEMENTS.assembly_bench.centerZM,
    6,
  )
  expect(world.tables.qc_bench.position.z).toBeCloseTo(
    TABLE_PLACEMENTS.assembly_bench.centerZM,
    6,
  )
  expect(world.tables.pack_out_bench.position.z).toBeCloseTo(
    TABLE_PLACEMENTS.qc_bench.centerZM,
    6,
  )
  // Boards wait in the untested tray on the QC bench; no motors to assemble.
  expect(world.finishedRack.group.parent).toBe(world.tables.qc_bench)
  expect(
    world.units.every(
      (unit) => unit.pcb.group.parent === world.finishedRack.group,
    ),
  ).toBe(true)
  expect(world.units.every((unit) => unit.motor.group.parent === null)).toBe(
    true,
  )
  expect(world.testMotor?.group.parent).toBe(world.tables.qc_bench)
  // Spacers, screws and cables wait at the bagging bench.
  expect(world.spacerBasket.parent).toBe(world.tables.pack_out_bench)
  expect(world.longScrewBin.parent).toBe(world.tables.pack_out_bench)
  expect(world.cableBin.parent).toBe(world.tables.pack_out_bench)
})

test(
  "a bare-unit batch of 30: tested beside the motor, screws pouched, everything bagged, 30 to a carton",
  () => {
    const simulation = new ManufacturingSimulation({ productLine: "bagged" })
    simulation.startScenario("run_batch")
    simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 6000 })
    const { world, progress } = simulation.ctx
    expect(progress.isJobComplete).toBe(true)
    // The board was never screwed to the test motor.
    const testMotor = world.testMotor
    if (!testMotor) throw new Error("No test motor")
    expect(
      testMotor.group.children.some((child) =>
        world.units.some((unit) => unit.pcb.group === child),
      ),
    ).toBe(false)
    expect(testMotor.rotor.rotation.y).toBeGreaterThan(Math.PI * 2 * 9 * 29)
    for (const unit of world.units) {
      const { bag, kit, screwPouch } = unit
      if (!bag || !kit || !screwPouch)
        throw new Error("Every unit is pouched and bagged")
      expect(unit.stage).toBe("shipped")
      expect(kit.group.parent).toBe(bag.group)
      expect(unit.spacer?.parent).toBe(kit.group)
      expect(unit.pcb.group.parent).toBe(kit.group)
      expect(kit.cable?.parent).toBe(kit.group)
      expect(screwPouch.group.parent).toBe(kit.group)
      expect(screwPouch.topFlap.rotation.x).toBeCloseTo(Math.PI, 5)
      expect(unit.longScrews).toHaveLength(4)
      expect(
        unit.longScrews.every((screw) => screw.parent === screwPouch.group),
      ).toBe(true)
      // The cable and pouch lie beside the board, not on it.
      const boardAt = unit.pcb.group.getWorldPosition(new Vector3())
      const pouchAt = screwPouch.group.getWorldPosition(new Vector3())
      expect(boardAt.distanceTo(pouchAt)).toBeGreaterThan(0.04)
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
  "bare-unit line, one at a time: test 2 boards, carry the passed tray, bag and ship 2",
  () => {
    const simulation = new ManufacturingSimulation({ productLine: "bagged" })
    simulation.setMode("game")
    simulation.setJobUnitCount(1)
    const { ctx } = simulation
    const standAt = (station: Station) => {
      const pose = getStationStandPose(station, ctx.tableLayout)
      ctx.operator.position.set(pose.x, 0, pose.z)
      ctx.operator.ccwYawRadians = pose.ccwYawRadians
      simulation.step(0.05)
    }
    const run = (kind: "bench" | "carry") => {
      expect(simulation.runGameAction(kind)).toBe(true)
      simulation.runUntilIdle({ dtSeconds: 0.05, maxSeconds: 2000 })
    }
    standAt(STATIONS.qc)
    expect(simulation.getGameActions().benchAction?.label).toBe(
      "Test a board (0 passed)",
    )
    run("bench")
    standAt(STATIONS.qc)
    run("bench")
    standAt(STATIONS.qc)
    expect(simulation.getGameActions().carryAction?.label).toBe(
      "Carry the passed tray to bagging now (2 passed)",
    )
    run("carry")
    standAt(STATIONS.packOut)
    run("bench")
    standAt(STATIONS.shipReady)
    run("bench")
    expect(ctx.progress.isJobComplete).toBe(true)
    expect(getOccupants(ctx.world.carton)).toHaveLength(2)
  },
  { timeout: 120_000 },
)

test("jumping to ship-ready has 30 bagged units in the tote", () => {
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
    world.units.every(
      (unit) => unit.screwPouch?.group.parent === unit.kit?.group,
    ),
  ).toBe(true)
})
