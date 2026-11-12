import { Group, type Object3D, Vector3 } from "three"
import {
  FOLDING_TABLE,
  TABLE_PLACEMENTS,
  type TableId,
} from "lib/layout/station-layout"
import { createBackfaceSpacer } from "lib/models/backface-spacer"
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
  SPACER_BENCH_SPOTS,
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
const MOTORS_IN_TRAY = 4
const PCBS_IN_STACK = 5
const JIG_HEIGHT_M = 0.03
const SPARE_SPACER_COUNT = 16
const SPARE_LONG_SCREW_COUNT = 18
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

function populateSpacerBench(table: Group): { spacer: Group } {
  const basket = createSpacerBasket()
  basket.position.copy(SPACER_BENCH_SPOTS.basket)
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
  spacer.position.set(0.02, 0.0175, 0.035)
  spacer.rotation.y = 0.3
  basket.add(spacer)
  return { spacer }
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

function populateAssemblyBench(
  table: Group,
): Pick<
  ManufacturingWorld,
  | "motor"
  | "pcb"
  | "screwdriver"
  | "longScrewBin"
  | "usedScrewBin"
  | "longScrews"
  | "motorCable"
> {
  const spots = ASSEMBLY_BENCH_SPOTS
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

  const tray = createRectangleShape({ widthM: 0.25, depthM: 0.07 })
  for (let slot = 0; slot < MOTORS_IN_TRAY; slot++) {
    tray.holes.push(
      createCircleHole({
        x: (slot - (MOTORS_IN_TRAY - 1) / 2) * spots.motorTraySpacingM,
        y: 0,
        radiusM: 0.012,
      }),
    )
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
  const motors: Nema17Motor[] = []
  for (let slot = 0; slot < MOTORS_IN_TRAY; slot++) {
    const motor = createNema17Motor()
    motor.group.position.set(
      spots.motorTrayCenter.x +
        (slot - (MOTORS_IN_TRAY - 1) / 2) * spots.motorTraySpacingM,
      TOP + JIG_HEIGHT_M,
      spots.motorTrayCenter.z,
    )
    table.add(motor.group)
    motors.push(motor)
  }

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

  const screwdriver = createScrewdriver()
  screwdriver.group.position.copy(spots.screwdriverRest)
  screwdriver.group.quaternion.copy(SCREWDRIVER_REST_QUATERNION)
  table.add(screwdriver.group)

  table.add(
    createBoxMesh({
      size: [0.06, 0.004, 0.06],
      material: BLACK_PLASTIC_MATERIAL,
      position: [
        spots.pcbStackBase.x,
        spots.pcbStackBase.y - 0.002,
        spots.pcbStackBase.z,
      ],
    }),
  )
  const pcbs: ControllerPcb[] = []
  for (let level = 0; level < PCBS_IN_STACK; level++) {
    const pcb = createControllerPcb()
    pcb.group.position.copy(spots.pcbStackBase)
    pcb.group.position.y += level * spots.pcbStackSpacingM
    table.add(pcb.group)
    pcbs.push(pcb)
  }

  const motorPlug = createJstPlug()
  const boardPlug = createJstPlug()
  motorPlug.group.position.copy(spots.motorCableStart).setY(TOP + 0.00225)
  boardPlug.group.position.copy(spots.motorCableStart).setY(TOP + 0.00225)
  boardPlug.group.position.z += 0.1
  motorPlug.group.quaternion.copy(PLUG_LYING_QUATERNION)
  boardPlug.group.quaternion.copy(PLUG_LYING_QUATERNION)
  table.add(motorPlug.group, boardPlug.group)
  const cable = createFlexCable({
    startAnchor: motorPlug.wireAnchor,
    endAnchor: boardPlug.wireAnchor,
    color: 0x1f2226,
    radiusM: 0.0012,
    minYM: TOP,
    slackOffset: new Vector3(0.07, 0, 0),
    leadLengthM: 0.012,
  })
  cable.slackFrame = table

  return {
    motor: motors[MOTORS_IN_TRAY - 1],
    pcb: pcbs[PCBS_IN_STACK - 1],
    screwdriver,
    longScrewBin,
    usedScrewBin,
    longScrews,
    motorCable: { cable, motorPlug, boardPlug },
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

/** Build the five line benches and every part on them, in their starting state. */
export function createWorld(): ManufacturingWorld {
  const root = new Group()
  const tables: Record<TableId, Group> = {
    spacer_bench: createPlacedTable("spacer_bench"),
    assembly_bench: createPlacedTable("assembly_bench"),
    qc_bench: createPlacedTable("qc_bench"),
    pack_out_bench: createPlacedTable("pack_out_bench"),
    ship_ready_bench: createPlacedTable("ship_ready_bench"),
  }
  for (const table of Object.values(tables)) root.add(table)
  const spacerBench = populateSpacerBench(tables.spacer_bench)
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
    ...spacerBench,
    ...assemblyBench,
    ...qcBench,
    ...packOutBench,
    removedStockScrews: [],
    cables,
  }
}
