import { expect, test } from "bun:test"
import { getOccupants } from "lib/job/container-slots"
import { JOB_ROWS } from "lib/job/job-plan"
import {
  BATCH_SIZE,
  OUTBOUND_SPOT,
  WORK_TABLE,
} from "lib/layout/station-layout"
import { CARTON_LABEL } from "lib/models/carton-label"
import { INKJET_OUTPUT } from "lib/models/inkjet-printer"
import {
  SHIPPING_CARTON,
  SHIPPING_CARTON_CAPACITY,
} from "lib/models/shipping-carton"
import { ManufacturingSimulation } from "lib/simulation/manufacturing-simulation"
import { Box3, Vector3 } from "three"

test(
  "a batch of 25 runs bench to bench and ships in one sealed, labeled Amazon carton",
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
    expect(BATCH_SIZE).toBe(25)
    expect(getOccupants(world.carton)).toHaveLength(BATCH_SIZE)
    expect(world.carton.occupants).toHaveLength(SHIPPING_CARTON_CAPACITY)
    expect(world.carton.tape.scale.x).toBeCloseTo(1, 5)
    expect(world.carton.frontFlap.rotation.x).toBeCloseTo(0, 5)
    expect(world.carton.group.parent).toBe(world.root)
    expect(world.carton.group.position.x).toBeCloseTo(OUTBOUND_SPOT.xM, 5)
    expect(world.carton.group.position.y).toBeCloseTo(0, 5)
    expect(world.cartonLabel.group.visible).toBe(true)
    expect(world.cartonLabel.group.parent).toBe(world.carton.group)
    expect(world.carrierLabel.group.visible).toBe(true)
    expect(world.carrierLabel.group.parent).toBe(world.carton.group)

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

test("the Epson prints both shipping labels in one trip before the carton ships", () => {
  const simulation = new ManufacturingSimulation()
  simulation.startAt("ship_ready")
  simulation.startScenario("run_batch")
  const { world, operator } = simulation.ctx
  const boxId = world.cartonLabel.group
  const carrier = world.carrierLabel.group
  const printer = world.labelPrinter.group
  const bench = world.tables.ship_ready_bench
  expect(printer.parent).toBe(world.tables.label_bench)
  expect(boxId.parent).toBe(printer)
  expect(carrier.parent).toBe(printer)
  expect(boxId.visible).toBe(false)
  expect(carrier.visible).toBe(false)

  const printed = new Set()
  let sawBothCarried = false
  let sawBothOnTable = false
  let sawBoxIdAppliedFirst = false
  let checkedTrayDuringCarrierPrint = false
  let printCues = 0
  for (let frame = 0; frame < 3_600 && simulation.isTaskRunning; frame++) {
    simulation.step(0.05)
    const cues = simulation.ctx.soundCues.splice(0)
    for (const label of [boxId, carrier]) {
      if (label.visible && label.parent === printer) {
        printCues += cues.filter((cue) => cue === "label_printer").length
        if (
          label.position.z > INKJET_OUTPUT.zM - CARTON_LABEL.lengthM / 2 &&
          label.position.z < INKJET_OUTPUT.zM + CARTON_LABEL.lengthM / 2
        )
          printed.add(label)
      }
    }
    if (
      carrier.visible &&
      carrier.parent === printer &&
      !checkedTrayDuringCarrierPrint
    ) {
      const sheetsBefore = world.labelPrinter.printedSheets.length
      simulation.printLabelsNow()
      expect(world.labelPrinter.printedSheets).toHaveLength(sheetsBefore)
      checkedTrayDuringCarrierPrint = true
    }
    if (
      boxId.parent === operator.group &&
      carrier.parent === operator.group &&
      operator.walkSpeedMps > 0
    ) {
      sawBothCarried = true
      expect(operator.rightHand.heldObject).toBe(boxId)
      expect(operator.leftHand.heldObject).toBe(carrier)
    }
    if (boxId.parent === bench && carrier.parent === bench) {
      sawBothOnTable = true
      expect(boxId.position.y).toBeCloseTo(WORK_TABLE.topHeightM, 6)
      expect(carrier.position.y).toBeCloseTo(WORK_TABLE.topHeightM, 6)
      expect(world.carton.tape.scale.x).toBeCloseTo(1, 6)
    }
    sawBoxIdAppliedFirst ||=
      boxId.parent === world.carton.group && carrier.parent === bench
  }
  expect(printed.size).toBe(2)
  expect(sawBothCarried).toBe(true)
  expect(sawBothOnTable).toBe(true)
  expect(sawBoxIdAppliedFirst).toBe(true)
  expect(checkedTrayDuringCarrierPrint).toBe(true)
  expect(printCues).toBe(2)
  expect(world.isCartonShipped).toBe(true)
  expect(Math.abs(boxId.position.x - carrier.position.x)).toBeGreaterThan(
    CARTON_LABEL.widthM,
  )
  for (const label of [boxId, carrier]) {
    expect(label.parent).toBe(world.carton.group)
    expect(label.position.z).toBeGreaterThan(
      SHIPPING_CARTON.innerWidthM / 2 + SHIPPING_CARTON.boardThicknessM,
    )
    expect(label.position.y + CARTON_LABEL.lengthM / 2).toBeLessThan(
      SHIPPING_CARTON.innerHeightM,
    )
    expect(Math.abs(label.position.x) + CARTON_LABEL.widthM / 2).toBeLessThan(
      SHIPPING_CARTON.innerLengthM / 2,
    )
    expect(
      new Vector3(0, 1, 0).applyQuaternion(label.quaternion).z,
    ).toBeCloseTo(1)
  }

  simulation.reset()
  const freshWorld = simulation.ctx.world
  for (const { group } of [freshWorld.cartonLabel, freshWorld.carrierLabel]) {
    expect(group.visible).toBe(false)
    expect(group.parent).toBe(freshWorld.labelPrinter.group)
  }
})

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
