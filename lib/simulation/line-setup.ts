import { releaseSlot, reserveSlot } from "lib/job/container-slots"
import { takeNextFromSheets, takeNextLabel } from "lib/job/label-stock"
import {
  FINISHED_RACK_SHUTTLE,
  READY_RACK_SHUTTLE,
  TOTE_SHUTTLE,
} from "lib/job/transfer-steps"
import {
  getSeatedScrewPosition,
  MOTOR_IN_BOX_POSITION,
  PCB_ON_MOTOR,
  PLUGGED_CABLE_SLACK,
  SPACER_ON_MOTOR,
} from "lib/job/unit-poses"
import { getStationStandPose } from "lib/layout/get-station-stand-pose"
import {
  STATIONS,
  type Station,
  TABLE_PLACEMENTS,
  type TableId,
} from "lib/layout/station-layout"
import { createBackfaceSpacer } from "lib/models/backface-spacer"
import { createCoiledJstCable } from "lib/models/coiled-jst-cable"
import { COILED_USB_CABLE } from "lib/models/coiled-usb-cable"
import { ESD_BAG, setEsdBagFilled } from "lib/models/esd-bag"
import { createM3Screw, LONG_SCREW_SHANK_M } from "lib/models/nema17-motor"
import { createPartKit } from "lib/models/part-kit"
import { createScrewPouch } from "lib/models/screw-pouch"
import { BOX_POCKETS, POCKET_FLOOR_YM } from "lib/models/white-mailer-box"
import type { SimContext } from "lib/simulation/sim-context"
import {
  BAG_LYING_QUATERNION,
  IDENTITY_QUATERNION,
  MOTOR_IN_BOX_QUATERNION,
  SCREW_LYING_QUATERNION,
} from "lib/world/bench-spots"
import { scatter, setOutMotorCable } from "lib/world/create-world"
import { type Object3D, Vector3 } from "three"

/** The line benches a session can start at, each with a full batch ready for it. */
export type LineStartId = "assembly" | "qc" | "pack_out" | "ship_ready"

export const LINE_STARTS: Record<
  LineStartId,
  { label: string; tableId: TableId; station: Station }
> = {
  assembly: {
    label: "Assembly: motors on the foam stand",
    tableId: "assembly_bench",
    station: STATIONS.assembly,
  },
  qc: {
    label: "QC: assembled, in the rack",
    tableId: "qc_bench",
    station: STATIONS.qc,
  },
  pack_out: {
    label: "Pack-out: tested, in the ready rack",
    tableId: "pack_out_bench",
    station: STATIONS.packOut,
  },
  ship_ready: {
    label: "Ship-ready: boxed, in the tote",
    tableId: "ship_ready_bench",
    station: STATIONS.shipReady,
  },
}

/** Finish a raw unit's assembly in place and set it in the finished rack. */
function assembleUnitInstantly(
  params: { unitIndex: number },
  ctx: SimContext,
): void {
  const { world } = ctx
  const unit = world.units[params.unitIndex]
  const { motor, pcb } = unit
  releaseSlot({ container: world.motorFoamStand, unitIndex: params.unitIndex })
  for (const stockScrew of motor.stockScrews) {
    const removedIndex = world.removedStockScrews.length
    world.usedScrewBin.add(stockScrew.group)
    stockScrew.group.position.set(
      (scatter(removedIndex + 900) - 0.5) * 0.07,
      0.0025 + 0.00275 + Math.floor(removedIndex / 16) * 0.004,
      (scatter(removedIndex + 950) - 0.5) * 0.09,
    )
    stockScrew.group.quaternion.copy(SCREW_LYING_QUATERNION)
    world.removedStockScrews.push(stockScrew.group)
  }
  const spacer = createBackfaceSpacer()
  motor.group.add(spacer)
  spacer.position.copy(SPACER_ON_MOTOR)
  unit.spacer = spacer
  motor.group.add(pcb.group)
  pcb.group.position.copy(PCB_ON_MOTOR)
  pcb.group.quaternion.identity()
  unit.longScrews = motor.stockScrews.map(({ corner }) => {
    const screw = createM3Screw({ shankLengthM: LONG_SCREW_SHANK_M })
    motor.group.add(screw)
    screw.position.copy(getSeatedScrewPosition(corner))
    return screw
  })
  const motorCable = setOutMotorCable({ world })
  motor.group.add(motorCable.motorPlug.group)
  motorCable.motorPlug.group.position.copy(motor.cableSocket.position)
  motorCable.motorPlug.group.quaternion.copy(motor.cableSocket.quaternion)
  pcb.group.add(motorCable.boardPlug.group)
  motorCable.boardPlug.group.position.copy(pcb.motorHeader.position)
  motorCable.boardPlug.group.quaternion.copy(pcb.motorHeader.quaternion)
  motorCable.cable.slackFrame = motor.group
  motorCable.cable.slackOffset.copy(PLUGGED_CABLE_SLACK)
  unit.motorCable = motorCable
  const slotIndex = reserveSlot({
    container: world.finishedRack,
    unitIndex: params.unitIndex,
  })
  world.finishedRack.group.add(motor.group)
  motor.group.position.copy(world.finishedRack.slots[slotIndex].position)
  motor.group.quaternion.identity()
  unit.stage = "assembled"
  unit.nextStepIndex = 0
}

/** Mark an assembled unit tested and move it to the ready rack. */
function testUnitInstantly(
  params: { unitIndex: number },
  ctx: SimContext,
): void {
  const { world } = ctx
  const unit = world.units[params.unitIndex]
  releaseSlot({ container: world.finishedRack, unitIndex: params.unitIndex })
  const slotIndex = reserveSlot({
    container: world.readyRack,
    unitIndex: params.unitIndex,
  })
  world.readyRack.group.add(unit.motor.group)
  unit.motor.group.position.copy(world.readyRack.slots[slotIndex].position)
  unit.motor.group.quaternion.identity()
  unit.motor.rotor.rotation.y = Math.PI * 18
  unit.stage = "tested"
  unit.nextStepIndex = 0
}

/** Box a tested unit with its cables, charger and label, and put the box in the tote. */
function packUnitInstantly(
  params: { unitIndex: number },
  ctx: SimContext,
): void {
  const { world } = ctx
  const unit = world.units[params.unitIndex]
  const { box } = unit
  releaseSlot({ container: world.readyRack, unitIndex: params.unitIndex })
  box.group.add(unit.motor.group)
  unit.motor.group.position.copy(MOTOR_IN_BOX_POSITION)
  unit.motor.group.quaternion.copy(MOTOR_IN_BOX_QUATERNION)
  const { usbCables, charger } = BOX_POCKETS
  for (const [index, coil] of unit.usbCables.entries()) {
    box.group.add(coil)
    coil.position.set(
      usbCables.x,
      POCKET_FLOOR_YM + index * COILED_USB_CABLE.heightM,
      usbCables.z,
    )
    coil.rotation.set(0, 0, 0)
  }
  box.group.add(unit.charger)
  unit.charger.position.set(charger.x, POCKET_FLOOR_YM, charger.z)
  unit.charger.quaternion.identity()
  box.lid.rotation.x = 0
  const label = takeNextLabel(world)
  if (label) {
    box.lid.add(label)
    label.position.copy(box.stickerSpot.position)
    label.quaternion.copy(IDENTITY_QUATERNION)
    unit.label = label
  }
  const slotIndex = reserveSlot({
    container: world.packingTote,
    unitIndex: params.unitIndex,
  })
  world.packingTote.group.add(box.group)
  box.group.position.copy(world.packingTote.slots[slotIndex].position)
  box.group.quaternion.identity()
  unit.stage = "packed"
  unit.nextStepIndex = 0
}

/** Bare-unit line: a board passed its spin test, from the untested tray to the passed tray. */
function testBoardInstantly(
  params: { unitIndex: number },
  ctx: SimContext,
): void {
  const { world } = ctx
  const unit = world.units[params.unitIndex]
  releaseSlot({ container: world.finishedRack, unitIndex: params.unitIndex })
  const slotIndex = reserveSlot({
    container: world.readyRack,
    unitIndex: params.unitIndex,
  })
  world.readyRack.group.add(unit.pcb.group)
  unit.pcb.group.position.copy(world.readyRack.slots[slotIndex].position)
  unit.pcb.group.quaternion.identity()
  unit.stage = "tested"
  unit.nextStepIndex = 0
}

/** Bare-unit line: screws in a folded pouch; spacer, board, cable and pouch zipped in the bag; labels on; bag in the tote. */
function bagUnitInstantly(
  params: { unitIndex: number },
  ctx: SimContext,
): void {
  const { world } = ctx
  const unit = world.units[params.unitIndex]
  const { bag } = unit
  if (!bag) return
  releaseSlot({ container: world.readyRack, unitIndex: params.unitIndex })
  const pouch = createScrewPouch()
  pouch.topFlap.rotation.x = Math.PI
  unit.screwPouch = pouch
  unit.longScrews = pouch.screwSpots.map((spot) => {
    const screw = createM3Screw({ shankLengthM: LONG_SCREW_SHANK_M })
    pouch.group.add(screw)
    screw.position.copy(spot.position)
    screw.quaternion.copy(spot.quaternion)
    return screw
  })
  setEsdBagFilled({ bag, isFilled: true })
  const contents = createPartKit()
  unit.kit = contents
  bag.group.add(contents.group)
  contents.group.position.copy(bag.contentsSpot.position)
  contents.group.quaternion.copy(bag.contentsSpot.quaternion)
  const place = (part: Object3D, spot: Object3D) => {
    contents.group.add(part)
    part.position.copy(spot.position)
    part.quaternion.copy(spot.quaternion)
  }
  const spacer = world.spacerStock.pop() ?? createBackfaceSpacer()
  unit.spacer = spacer
  place(spacer, contents.spacerSpot)
  place(unit.pcb.group, contents.pcbSpot)
  const coil = createCoiledJstCable()
  place(coil, contents.cableSpot)
  contents.cable = coil
  place(pouch.group, contents.pouchSpot)
  contents.screwPouch = pouch.group
  const sticker = takeNextLabel(world)
  if (sticker) {
    bag.group.add(sticker)
    sticker.position.copy(bag.frontStickerSpot.position)
    sticker.quaternion.copy(bag.frontStickerSpot.quaternion)
    unit.label = sticker
  }
  const fnsku = takeNextFromSheets(world.fnskuSheets)
  if (fnsku) {
    bag.group.add(fnsku)
    fnsku.position.copy(bag.backLabelSpot.position)
    fnsku.quaternion.copy(bag.backLabelSpot.quaternion)
    unit.fnskuLabel = fnsku
  }
  const slotIndex = reserveSlot({
    container: world.packingTote,
    unitIndex: params.unitIndex,
  })
  world.packingTote.group.add(bag.group)
  bag.group.position
    .copy(world.packingTote.slots[slotIndex].position)
    .add(new Vector3(0, ESD_BAG.filledDepthM / 2, ESD_BAG.heightM / 2))
  bag.group.quaternion.copy(BAG_LYING_QUATERNION)
  unit.stage = "packed"
  unit.nextStepIndex = 0
}

function moveShuttle(
  params: { shuttle: typeof FINISHED_RACK_SHUTTLE; toNextBench: boolean },
  ctx: SimContext,
): void {
  const { shuttle } = params
  const container = shuttle.get(ctx.world)
  const table =
    ctx.world.tables[params.toNextBench ? shuttle.nextTable : shuttle.homeTable]
  table.add(container.group)
  container.group.position.copy(
    params.toNextBench ? shuttle.nextPosition : shuttle.homePosition,
  )
  container.group.quaternion.identity()
}

/**
 * Set the line up with the whole batch ready for one bench: earlier benches'
 * work is done instantly and the batch's container is waiting at that bench.
 * Call on a freshly reset world. Puts the operator at the bench.
 */
export function setUpLineAt(
  params: { startId: LineStartId },
  ctx: SimContext,
): void {
  const order: LineStartId[] = ["assembly", "qc", "pack_out", "ship_ready"]
  const depth = order.indexOf(params.startId)
  const unitIndices = ctx.world.units
    .slice(0, ctx.progress.unitCount)
    .map((_, unitIndex) => unitIndex)
  if (ctx.world.productLine === "bagged") {
    // No assembly bench: boards start in the untested tray at QC.
    if (depth >= 2) {
      for (const unitIndex of unitIndices)
        testBoardInstantly({ unitIndex }, ctx)
      moveShuttle({ shuttle: READY_RACK_SHUTTLE, toNextBench: true }, ctx)
    }
    if (depth >= 3) {
      for (const unitIndex of unitIndices) bagUnitInstantly({ unitIndex }, ctx)
      moveShuttle({ shuttle: READY_RACK_SHUTTLE, toNextBench: false }, ctx)
      moveShuttle({ shuttle: TOTE_SHUTTLE, toNextBench: true }, ctx)
    }
  } else {
    if (depth >= 1) {
      for (const unitIndex of unitIndices)
        assembleUnitInstantly({ unitIndex }, ctx)
      moveShuttle({ shuttle: FINISHED_RACK_SHUTTLE, toNextBench: true }, ctx)
    }
    if (depth >= 2) {
      for (const unitIndex of unitIndices) testUnitInstantly({ unitIndex }, ctx)
      moveShuttle({ shuttle: FINISHED_RACK_SHUTTLE, toNextBench: false }, ctx)
      moveShuttle({ shuttle: READY_RACK_SHUTTLE, toNextBench: true }, ctx)
    }
    if (depth >= 3) {
      for (const unitIndex of unitIndices) packUnitInstantly({ unitIndex }, ctx)
      moveShuttle({ shuttle: READY_RACK_SHUTTLE, toNextBench: false }, ctx)
      moveShuttle({ shuttle: TOTE_SHUTTLE, toNextBench: true }, ctx)
    }
  }
  const start = LINE_STARTS[params.startId]
  // The bare-unit line has no assembly bench: its first stop is QC.
  const station =
    start.tableId === "assembly_bench" && !ctx.tableLayout.assembly_bench
      ? LINE_STARTS.qc.station
      : start.station
  const pose = getStationStandPose(station, ctx.tableLayout)
  ctx.operator.position.set(pose.x, 0, pose.z)
  ctx.operator.ccwYawRadians = pose.ccwYawRadians
  ctx.world.root.updateMatrixWorld(true)
  ctx.statusText = `${start.label}: ${unitIndices.length} ready at the ${TABLE_PLACEMENTS[start.tableId].label}`
}
