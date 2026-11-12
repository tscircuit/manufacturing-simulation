import { Group, type Object3D, Vector3 } from "three"
import {
  FOLDING_TABLE,
  TABLE_PLACEMENTS,
  type TableId,
} from "lib/layout/station-layout"
import { createBackfaceSpacer } from "lib/models/backface-spacer"
import { createCoiledJstCable } from "lib/models/coiled-jst-cable"
import {
  COILED_USB_CABLE,
  createCoiledUsbCable,
} from "lib/models/coiled-usb-cable"
import {
  type ControllerPcb,
  createControllerPcb,
} from "lib/models/controller-pcb"
import { createFlexCable, type FlexCable } from "lib/models/flex-cable"
import { createFoldingTable } from "lib/models/folding-table"
import {
  createM3Screw,
  createNema17Motor,
  LONG_SCREW_SHANK_M,
  type Nema17Motor,
} from "lib/models/nema17-motor"
import { createPartsBin, PARTS_BIN } from "lib/models/parts-bin"
import { type CablePlug, createJstPlug, createUsbCPlug } from "lib/models/plugs"
import { createQcCradle } from "lib/models/qc-cradle"
import { createQcLaptop, type QcLaptop } from "lib/models/qc-laptop"
import { createScrewdriver, type Screwdriver } from "lib/models/screwdriver"
import { createSpacerBasket } from "lib/models/spacer-basket"
import { createInkjetPrinter } from "lib/models/inkjet-printer"
import { createLabelSheet } from "lib/models/label-sheet"
import {
  createGanChargingStation,
  createUsbCharger,
  USB_CHARGER,
} from "lib/models/usb-charger"
import {
  createWhiteMailerBox,
  WHITE_MAILER_BOX,
  type WhiteMailerBox,
} from "lib/models/white-mailer-box"
import {
  createBoxMesh,
  createCircleHole,
  createExtrudedMesh,
  createRectangleShape,
  createStandardMaterial,
} from "lib/scene/primitives"
import { BLACK_PLASTIC_MATERIAL } from "lib/scene/shared-materials"
import {
  ASSEMBLY_BENCH_SPOTS,
  PACK_OUT_BENCH_SPOTS,
  PLUG_LYING_QUATERNION,
  QC_BENCH_SPOTS,
  SCREW_LYING_QUATERNION,
  SCREWDRIVER_REST_QUATERNION,
  SHIP_READY_BENCH_SPOTS,
} from "lib/world/bench-spots"

/** Pre-crimped JST-PH cable between the motor and the PCB. */
export interface MotorCable {
  cable: FlexCable
  motorPlug: CablePlug
  boardPlug: CablePlug
}

/** A USB-C cable permanently attached to a QC bench device at one end. */
export interface QcCable {
  cable: FlexCable
  plug: CablePlug
}

/**
 * Everything movable on the line. Single-object fields are the units used by
 * the current job; the rest of each stack is scenery.
 */
export interface ManufacturingWorld {
  root: Group
  tables: Record<TableId, Group>
  spacer: Group
  motor: Nema17Motor
  pcb: ControllerPcb
  screwdriver: Screwdriver
  longScrewBin: Group
  usedScrewBin: Group
  /** Bin of pre-crimped JST-PH motor cables. */
  cableBin: Group
  /** Four long screws for this unit, in the long-screw bin. */
  longScrews: Group[]
  /** Stock screws taken out of the motor, in the used-screw bin. */
  removedStockScrews: Group[]
  motorCable: MotorCable
  laptop: QcLaptop
  qcDataCable: QcCable
  qcPowerCable: QcCable
  box: WhiteMailerBox
  packedUsbCables: Group[]
  packedCharger: Group
  labelSheet: Group
  /** The label for this unit, still on the sheet. */
  sticker: Group
  /** Every cable whose wire must be redrawn as its ends move. */
  cables: FlexCable[]
}

const TOP = FOLDING_TABLE.topHeightM
const MOTOR_TRAY_COLUMNS = 4
const MOTOR_TRAY_ROWS = 3
const PCBS_PER_STACK = 5
const JIG_HEIGHT_M = 0.03
const SPARE_SPACER_COUNT = 16
const SPARE_LONG_SCREW_COUNT = 18
const SPARE_MOTOR_CABLE_COUNT = 4
const BOXES_IN_STACK = 3
const COILS_IN_STACK = 4
const CHARGERS_IN_STACK = 3
const CABLE_RADIUS_M = 0.0018

/** Deterministic pseudo-random 0..1 so scenery is the same on every run. */
function scatter(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function createPlacedTable(tableId: TableId): Group {
  const placement = TABLE_PLACEMENTS[tableId]
  const table = createFoldingTable()
  table.name = tableId
  table.position.set(placement.centerXM, 0, placement.centerZM)
  table.rotation.y = placement.ccwYawRadians
  return table
}

function addSpacerBasket(table: Group): Group {
  const basket = createSpacerBasket()
  basket.position.copy(ASSEMBLY_BENCH_SPOTS.spacerBasket)
  table.add(basket)
  for (let index = 0; index < SPARE_SPACER_COUNT; index++) {
    const spacer = createBackfaceSpacer()
    spacer.position.set(
      (scatter(index + 1) - 0.5) * 0.15,
      0.003 + Math.floor(index / 6) * 0.0042,
      (scatter(index + 40) - 0.5) * 0.09,
    )
    spacer.rotation.y = scatter(index + 80) * Math.PI
    basket.add(spacer)
  }
  const spacer = createBackfaceSpacer()
  spacer.position.set(-0.04, 0.0175, 0.035)
  spacer.rotation.y = 0.3
  basket.add(spacer)
  return spacer
}

function addScrewsToBin(params: {
  bin: Group
  count: number
  seedOffset: number
}): Group[] {
  const screws: Group[] = []
  const floorYM = 0.0025 + 0.00275
  for (let index = 0; index < params.count; index++) {
    const screw = createM3Screw({ shankLengthM: LONG_SCREW_SHANK_M })
    const seed = index + params.seedOffset
    screw.position.set(
      (scatter(seed) - 0.5) * (PARTS_BIN.widthM - 0.03),
      floorYM + Math.floor(index / 9) * 0.004,
      (scatter(seed + 13) - 0.5) * (PARTS_BIN.depthM - 0.04),
    )
    screw.quaternion.copy(SCREW_LYING_QUATERNION)
    screw.rotateOnWorldAxis(
      new Vector3(0, 1, 0),
      scatter(seed + 29) * Math.PI * 2,
    )
    params.bin.add(screw)
    screws.push(screw)
  }
  return screws
}

function addMotorTray(table: Group): Nema17Motor {
  const spots = ASSEMBLY_BENCH_SPOTS
  const pitchM = spots.motorTraySpacingM
  const tray = createRectangleShape({
    widthM: MOTOR_TRAY_COLUMNS * pitchM + 0.03,
    depthM: MOTOR_TRAY_ROWS * pitchM + 0.015,
  })
  const slotOffsets: Array<{ x: number; z: number }> = []
  for (let row = 0; row < MOTOR_TRAY_ROWS; row++) {
    for (let column = 0; column < MOTOR_TRAY_COLUMNS; column++) {
      const offset = {
        x: (column - (MOTOR_TRAY_COLUMNS - 1) / 2) * pitchM,
        z: (row - (MOTOR_TRAY_ROWS - 1) / 2) * pitchM,
      }
      slotOffsets.push(offset)
      // Shape Y maps to -Z after extrusion.
      tray.holes.push(
        createCircleHole({ x: offset.x, y: -offset.z, radiusM: 0.012 }),
      )
    }
  }
  const trayMesh = createExtrudedMesh({
    shape: tray,
    depthM: JIG_HEIGHT_M,
    material: createStandardMaterial({ color: 0x39424b }),
    baseYM: TOP,
  })
  trayMesh.position.x = spots.motorTrayCenter.x
  trayMesh.position.z = spots.motorTrayCenter.z
  table.add(trayMesh)
  const motors = slotOffsets.map((offset) => {
    const motor = createNema17Motor()
    motor.group.position.set(
      spots.motorTrayCenter.x + offset.x,
      TOP + JIG_HEIGHT_M,
      spots.motorTrayCenter.z + offset.z,
    )
    table.add(motor.group)
    return motor
  })
  // Take from the front row, nearest the jig.
  return motors[(MOTOR_TRAY_ROWS - 1) * MOTOR_TRAY_COLUMNS]
}

function addPcbStacks(table: Group): ControllerPcb {
  const spots = ASSEMBLY_BENCH_SPOTS
  const stacks = spots.pcbStackBases.map((base) => {
    table.add(
      createBoxMesh({
        size: [0.06, 0.004, 0.06],
        material: BLACK_PLASTIC_MATERIAL,
        position: [base.x, base.y - 0.002, base.z],
      }),
    )
    const pcbs: ControllerPcb[] = []
    for (let level = 0; level < PCBS_PER_STACK; level++) {
      const pcb = createControllerPcb()
      pcb.group.position.copy(base)
      pcb.group.position.y += level * spots.pcbStackSpacingM
      table.add(pcb.group)
      pcbs.push(pcb)
    }
    return pcbs
  })
  return stacks[0][PCBS_PER_STACK - 1]
}

/** Cable bin with spare coiled cables and, on top, the cable for this unit with both plugs at the scoop. */
function addCableBin(table: Group): {
  cableBin: Group
  motorCable: MotorCable
} {
  const cableBin = createPartsBin({ labelColor: 0xf2c230 })
  cableBin.position.copy(ASSEMBLY_BENCH_SPOTS.cableBin)
  table.add(cableBin)
  for (let index = 0; index < SPARE_MOTOR_CABLE_COUNT; index++) {
    const coil = createCoiledJstCable()
    coil.position.set(
      (scatter(index + 500) - 0.5) * 0.03,
      0.0025 + index * 0.0028,
      -0.02 + (scatter(index + 520) - 0.5) * 0.03,
    )
    coil.rotation.y = scatter(index + 540) * Math.PI * 2
    cableBin.add(coil)
  }
  const motorPlug = createJstPlug()
  const boardPlug = createJstPlug()
  for (const [index, plug] of [motorPlug, boardPlug].entries()) {
    plug.group.position.set(-0.015 + index * 0.03, 0.016, 0.035)
    plug.group.quaternion.copy(PLUG_LYING_QUATERNION)
    cableBin.add(plug.group)
  }
  const cable = createFlexCable({
    startAnchor: motorPlug.wireAnchor,
    endAnchor: boardPlug.wireAnchor,
    color: 0x1f2226,
    radiusM: 0.0012,
    minYM: TOP + 0.004,
    slackOffset: new Vector3(0, 0, -0.05),
    leadLengthM: 0.012,
  })
  cable.slackFrame = cableBin
  return { cableBin, motorCable: { cable, motorPlug, boardPlug } }
}

function populateAssemblyBench(
  table: Group,
): Pick<
  ManufacturingWorld,
  | "spacer"
  | "motor"
  | "pcb"
  | "screwdriver"
  | "longScrewBin"
  | "usedScrewBin"
  | "cableBin"
  | "longScrews"
  | "motorCable"
> {
  const spots = ASSEMBLY_BENCH_SPOTS
  const spacer = addSpacerBasket(table)
  const motor = addMotorTray(table)
  const pcb = addPcbStacks(table)

  const jig = createRectangleShape({ widthM: 0.07, depthM: 0.07 })
  jig.holes.push(createCircleHole({ x: 0, y: 0, radiusM: 0.012 }))
  const jigMesh = createExtrudedMesh({
    shape: jig,
    depthM: JIG_HEIGHT_M,
    material: createStandardMaterial({ color: 0x4d5a66 }),
    baseYM: TOP,
  })
  jigMesh.position.x = spots.jigTop.x
  jigMesh.position.z = spots.jigTop.z
  table.add(jigMesh)

  const longScrewBin = createPartsBin({ labelColor: 0x2f6fb0 })
  longScrewBin.position.copy(spots.longScrewBin)
  const usedScrewBin = createPartsBin({ labelColor: 0xd04a3c })
  usedScrewBin.position.copy(spots.usedScrewBin)
  table.add(longScrewBin, usedScrewBin)
  addScrewsToBin({
    bin: longScrewBin,
    count: SPARE_LONG_SCREW_COUNT,
    seedOffset: 1,
  })
  const longScrews = addScrewsToBin({
    bin: longScrewBin,
    count: 4,
    seedOffset: 300,
  })
  for (const [index, screw] of longScrews.entries()) {
    // The four for this unit sit on top, near the scoop.
    screw.position.set((index - 1.5) * 0.02, 0.0125, 0.035)
  }
  const { cableBin, motorCable } = addCableBin(table)

  const screwdriver = createScrewdriver()
  screwdriver.group.position.copy(spots.screwdriverRest)
  screwdriver.group.quaternion.copy(SCREWDRIVER_REST_QUATERNION)
  table.add(screwdriver.group)

  return {
    spacer,
    motor,
    pcb,
    screwdriver,
    longScrewBin,
    usedScrewBin,
    cableBin,
    longScrews,
    motorCable,
  }
}

function createQcCable(params: {
  table: Group
  startAnchor: Object3D
  restPosition: Vector3
  color: number
}): QcCable {
  const plug = createUsbCPlug({
    overmoldColor: params.color === 0x1f2226 ? undefined : params.color,
  })
  plug.group.position.copy(params.restPosition)
  plug.group.quaternion.copy(PLUG_LYING_QUATERNION)
  params.table.add(plug.group)
  const cable = createFlexCable({
    startAnchor: params.startAnchor,
    endAnchor: plug.wireAnchor,
    color: params.color,
    radiusM: CABLE_RADIUS_M,
    minYM: TOP,
    slackOffset: new Vector3(0, 0.02, 0.05),
  })
  cable.slackFrame = params.table
  return { cable, plug }
}

function populateQcBench(
  table: Group,
): Pick<ManufacturingWorld, "laptop" | "qcDataCable" | "qcPowerCable"> {
  const spots = QC_BENCH_SPOTS
  const laptop = createQcLaptop()
  laptop.group.position.copy(spots.laptop)
  const cradle = createQcCradle()
  cradle.position.copy(spots.cradle)
  const chargingStation = createGanChargingStation()
  chargingStation.group.position.copy(spots.chargingStation)
  table.add(laptop.group, cradle, chargingStation.group)
  return {
    laptop,
    qcDataCable: createQcCable({
      table,
      startAnchor: laptop.usbPortAnchor,
      restPosition: spots.dataPlugRest,
      color: 0x1f2226,
    }),
    qcPowerCable: createQcCable({
      table,
      startAnchor: chargingStation.portAnchor,
      restPosition: spots.powerPlugRest,
      color: 0xeeeeea,
    }),
  }
}

function populatePackOutBench(
  table: Group,
): Pick<
  ManufacturingWorld,
  "box" | "packedUsbCables" | "packedCharger" | "labelSheet" | "sticker"
> {
  const spots = PACK_OUT_BENCH_SPOTS
  const boxes: WhiteMailerBox[] = []
  for (let level = 0; level < BOXES_IN_STACK; level++) {
    const box = createWhiteMailerBox()
    box.group.position.copy(spots.boxStack)
    box.group.position.y += level * (WHITE_MAILER_BOX.heightM + 0.004)
    table.add(box.group)
    boxes.push(box)
  }
  const coils: Group[] = []
  for (let level = 0; level < COILS_IN_STACK; level++) {
    const coil = createCoiledUsbCable()
    coil.position.copy(spots.cableCoilStack)
    coil.position.y += level * COILED_USB_CABLE.heightM
    coil.rotation.y = level * 0.7
    table.add(coil)
    coils.push(coil)
  }
  const chargers: Group[] = []
  for (let level = 0; level < CHARGERS_IN_STACK; level++) {
    const charger = createUsbCharger().group
    charger.position.copy(spots.chargerStack)
    charger.position.y += level * USB_CHARGER.heightM
    table.add(charger)
    chargers.push(charger)
  }
  const printer = createInkjetPrinter()
  printer.position.copy(spots.inkjetPrinter)
  const labelSheet = createLabelSheet()
  labelSheet.group.position.copy(spots.labelSheet)
  table.add(printer, labelSheet.group)
  // Take labels from the front row, nearest the operator.
  const sticker = labelSheet.labels[labelSheet.labels.length - 1]
  return {
    box: boxes[BOXES_IN_STACK - 1],
    packedUsbCables: [coils[COILS_IN_STACK - 1], coils[COILS_IN_STACK - 2]],
    packedCharger: chargers[CHARGERS_IN_STACK - 1],
    labelSheet: labelSheet.group,
    sticker,
  }
}

function populateShipReadyBench(table: Group): void {
  const { outgoing } = SHIP_READY_BENCH_SPOTS
  table.add(
    createBoxMesh({
      size: [0.62, 0.002, 0.36],
      material: createStandardMaterial({ color: 0x2e7d5b, roughness: 0.9 }),
      position: [outgoing.x + 0.12, TOP + 0.001, outgoing.z + 0.02],
    }),
  )
}

/** Build the four line benches and every part on them, in their starting state. */
export function createWorld(): ManufacturingWorld {
  const root = new Group()
  const tables: Record<TableId, Group> = {
    assembly_bench: createPlacedTable("assembly_bench"),
    qc_bench: createPlacedTable("qc_bench"),
    pack_out_bench: createPlacedTable("pack_out_bench"),
    ship_ready_bench: createPlacedTable("ship_ready_bench"),
  }
  for (const table of Object.values(tables)) root.add(table)
  const assemblyBench = populateAssemblyBench(tables.assembly_bench)
  const qcBench = populateQcBench(tables.qc_bench)
  const packOutBench = populatePackOutBench(tables.pack_out_bench)
  populateShipReadyBench(tables.ship_ready_bench)
  const cables = [
    assemblyBench.motorCable.cable,
    qcBench.qcDataCable.cable,
    qcBench.qcPowerCable.cable,
  ]
  for (const cable of cables) root.add(cable.wire)
  root.updateMatrixWorld(true)
  return {
    root,
    tables,
    ...assemblyBench,
    ...qcBench,
    ...packOutBench,
    removedStockScrews: [],
    cables,
  }
}
