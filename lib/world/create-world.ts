import {
  BATCH_SIZE,
  TABLE_PLACEMENTS,
  type TableId,
  WORK_TABLE,
} from "lib/layout/station-layout"
import { createBackfaceSpacer } from "lib/models/backface-spacer"
import {
  type BambuPrinter,
  createBambuPrinter,
  populatePlate,
} from "lib/models/bambu-printer"
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
import { createInkjetPrinter } from "lib/models/inkjet-printer"
import {
  createLabelSheet,
  LABEL_SHEET,
  LABEL_SHEET_STACK_PITCH_M,
  type LabelSheet,
} from "lib/models/label-sheet"
import {
  createMotorFoamStand,
  createMotorRack,
  type MotorRack,
} from "lib/models/motor-rack"
import {
  createM3Screw,
  createNema17Motor,
  LONG_SCREW_SHANK_M,
  type Nema17Motor,
} from "lib/models/nema17-motor"
import { createPackingTote, type PackingTote } from "lib/models/packing-tote"
import { createPartsBin, PARTS_BIN } from "lib/models/parts-bin"
import { type CablePlug, createJstPlug, createUsbCPlug } from "lib/models/plugs"
import { createQcCradle } from "lib/models/qc-cradle"
import { createQcLaptop, type QcLaptop } from "lib/models/qc-laptop"
import { createScrewdriver, type Screwdriver } from "lib/models/screwdriver"
import {
  createShippingCarton,
  type ShippingCarton,
} from "lib/models/shipping-carton"
import {
  ASSEMBLY_SPACER_BASKET,
  createSpacerBasket,
  getSpacerPilePosition,
  SPACER_TUB,
} from "lib/models/spacer-basket"
import { createStandingDesk } from "lib/models/standing-desk"
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
  LABEL_BENCH_SPOTS,
  PACK_OUT_BENCH_SPOTS,
  PLUG_LYING_QUATERNION,
  PRINTER_BENCH_SPOTS,
  QC_BENCH_SPOTS,
  SCREW_LYING_QUATERNION,
  SCREWDRIVER_REST_QUATERNION,
  SHIP_READY_BENCH_SPOTS,
} from "lib/world/bench-spots"
import { Group, type Object3D, Vector3 } from "three"

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
 * Where a unit is in the line: raw on the foam stand, assembled (spacer, PCB,
 * long screws, cable), tested at QC, packed in its mailer, in the Amazon
 * carton, or shipped once the carton is sealed.
 */
export type UnitStage =
  | "raw"
  | "assembled"
  | "tested"
  | "packed"
  | "in_carton"
  | "shipped"

/** Everything that goes into one finished, packed unit. */
export interface AssemblyUnit {
  stage: UnitStage
  /** Next step of the current stage's per-unit steps; 0 when the stage hasn't started. */
  nextStepIndex: number
  motor: Nema17Motor
  pcb: ControllerPcb
  /** Taken from the basket when the spacer is fitted. */
  spacer: Group | null
  /** Taken from the long-screw bin when they are driven. */
  longScrews: Group[]
  /** Taken from the cable bin when it is plugged in. */
  motorCable: MotorCable | null
  box: WhiteMailerBox
  usbCables: Group[]
  charger: Group
  /** Peeled from the top label sheet at pack-out. */
  label: Group | null
  fnskuLabel: Group | null
}

/** The shared printer for branding and sample FNSKU sheets. */
export interface LabelPrinterState {
  group: Group
  outputStack: Group
  /** Printed sheets waiting in the output tray, bottom first. */
  printedSheets: LabelSheet[]
  /** Sheet being fed or carried to pack-out for the current job. */
  activeFnskuSheet: LabelSheet | null
  secondsSinceLastSheet: number
}

/** Everything movable on the floor. */
export interface ManufacturingWorld {
  root: Group
  tables: Record<TableId, Group>
  units: AssemblyUnit[]
  motorFoamStand: MotorRack
  /** Rack the assembled units go into; carried from assembly to QC. */
  finishedRack: MotorRack
  /** Rack the tested units go into; carried from QC to pack-out. */
  readyRack: MotorRack
  spacerBasket: Group
  /** Spacers in the basket, in pile order; the last one is on top. */
  spacerStock: Group[]
  screwdriver: Screwdriver
  longScrewBin: Group
  usedScrewBin: Group
  cableBin: Group
  /** Stock screws taken out of the motors, in the used-screw bin. */
  removedStockScrews: Group[]
  laptop: QcLaptop
  qcDataCable: QcCable
  qcPowerCable: QcCable
  /** Label sheets on the pack-out bench, top sheet first; used labels are removed from each sheet. */
  labelSheets: LabelSheet[]
  fnskuLabelSheets: LabelSheet[]
  packingTote: PackingTote
  carton: ShippingCarton
  printers: BambuPrinter[]
  /** Empty tubs on the printer bench; the last one is used next. */
  emptyTubs: Group[]
  /** Tubs emptied into the basket, stacked on the assembly bench. */
  usedTubs: Group[]
  /** The tub being carried, and the spacers in it. */
  carriedTub: Group | null
  tubSpacers: Group[]
  labelPrinter: LabelPrinterState
  /** True once the sealed carton is out by the door. */
  isCartonShipped: boolean
  /** Every cable whose wire must be redrawn as its ends move. */
  cables: FlexCable[]
}

const TOP = WORK_TABLE.topHeightM
const PCBS_PER_STACK = 10
const JIG_HEIGHT_M = 0.03
/** Enough for one batch plus a few; the printers refill the basket. */
const STARTING_SPACER_COUNT = 34
const SPARE_LONG_SCREW_COUNT = 18
const SPARE_MOTOR_CABLE_COUNT = 6
const BOXES_PER_STACK = 6
const COILS_PER_STACK = 20
const CHARGERS_PER_STACK = 10
const LABEL_SHEET_COUNT = 3
const EMPTY_TUB_COUNT = 3
const TUB_NESTING_M = 0.012
const CABLE_RADIUS_M = 0.0018

/** Deterministic pseudo-random 0..1 so scenery is the same on every run. */
export function scatter(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function createPlacedTable(tableId: TableId): Group {
  const placement = TABLE_PLACEMENTS[tableId]
  const table = createStandingDesk()
  table.name = tableId
  table.position.set(placement.centerXM, 0, placement.centerZM)
  table.rotation.y = placement.ccwYawRadians
  return table
}

/** Put a spacer at the next pile position in a basket or tub. */
export function addSpacerToPile(params: {
  container: Group
  size: typeof ASSEMBLY_SPACER_BASKET
  spacer: Group
  index: number
}): void {
  params.container.add(params.spacer)
  params.spacer.position.copy(
    getSpacerPilePosition({ index: params.index, container: params.size }),
  )
  params.spacer.rotation.set(0, (scatter(params.index + 80) - 0.5) * 0.8, 0)
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

/** Lay out four long screws for the next unit on top, near the bin's scoop. */
export function setOutLongScrews(params: {
  bin: Group
  unitIndex: number
}): Group[] {
  const screws = addScrewsToBin({
    bin: params.bin,
    count: 4,
    seedOffset: 300 + params.unitIndex * 7,
  })
  for (const [index, screw] of screws.entries())
    screw.position.set((index - 1.5) * 0.02, 0.0125, 0.035)
  return screws
}

/** Lay out the next pre-crimped cable with both plugs at the cable bin's scoop. */
export function setOutMotorCable(params: {
  world: ManufacturingWorld
}): MotorCable {
  const { world } = params
  const { cableBin } = world
  const motorPlug = createJstPlug({ pinCount: 6 })
  const boardPlug = createJstPlug({ pinCount: 4 })
  for (const [index, plug] of [motorPlug, boardPlug].entries()) {
    plug.group.position.set(-0.015 + index * 0.03, 0.022, 0.035)
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
  world.root.add(cable.wire)
  world.cables.push(cable)
  return { cable, motorPlug, boardPlug }
}

function populateAssemblyBench(table: Group) {
  const spots = ASSEMBLY_BENCH_SPOTS
  const spacerBasket = createSpacerBasket(ASSEMBLY_SPACER_BASKET)
  spacerBasket.position.copy(spots.spacerBasket)
  table.add(spacerBasket)
  const spacerStock: Group[] = []
  for (let index = 0; index < STARTING_SPACER_COUNT; index++) {
    const spacer = createBackfaceSpacer()
    addSpacerToPile({
      container: spacerBasket,
      size: ASSEMBLY_SPACER_BASKET,
      spacer,
      index,
    })
    spacerStock.push(spacer)
  }

  const motorFoamStand = createMotorFoamStand()
  motorFoamStand.group.position.copy(spots.motorFoamStand)
  const motors = motorFoamStand.slots.map((slot) => {
    const motor = createNema17Motor()
    motor.group.position.copy(slot.position)
    motorFoamStand.group.add(motor.group)
    return motor
  })
  const finishedRack = createMotorRack()
  finishedRack.group.position.copy(spots.finishedRack)
  table.add(motorFoamStand.group, finishedRack.group)

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
  const cableBin = createPartsBin({ labelColor: 0xf2c230 })
  cableBin.position.copy(spots.cableBin)
  table.add(longScrewBin, usedScrewBin, cableBin)
  addScrewsToBin({
    bin: longScrewBin,
    count: SPARE_LONG_SCREW_COUNT,
    seedOffset: 1,
  })
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

  const pcbs: ControllerPcb[] = []
  for (const base of spots.pcbStackBases) {
    table.add(
      createBoxMesh({
        size: [0.06, 0.004, 0.06],
        material: BLACK_PLASTIC_MATERIAL,
        position: [base.x, base.y - 0.002, base.z],
      }),
    )
    const stack: ControllerPcb[] = []
    for (let level = 0; level < PCBS_PER_STACK; level++) {
      const pcb = createControllerPcb()
      pcb.group.position.copy(base)
      pcb.group.position.y += level * spots.pcbStackSpacingM
      table.add(pcb.group)
      stack.push(pcb)
    }
    // Take from the top of each stack, nearest stack first.
    pcbs.push(...stack.reverse())
  }

  const screwdriver = createScrewdriver()
  screwdriver.group.position.copy(spots.screwdriverRest)
  screwdriver.group.quaternion.copy(SCREWDRIVER_REST_QUATERNION)
  table.add(screwdriver.group)

  return {
    spacerBasket,
    spacerStock,
    motorFoamStand,
    finishedRack,
    motors,
    pcbs,
    screwdriver,
    longScrewBin,
    usedScrewBin,
    cableBin,
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

function populateQcBench(table: Group) {
  const spots = QC_BENCH_SPOTS
  const laptop = createQcLaptop()
  laptop.group.position.copy(spots.laptop)
  const cradle = createQcCradle()
  cradle.position.copy(spots.cradle)
  const chargingStation = createGanChargingStation()
  chargingStation.group.position.copy(spots.chargingStation)
  const readyRack = createMotorRack()
  readyRack.group.position.copy(spots.readyRack)
  table.add(laptop.group, cradle, chargingStation.group, readyRack.group)
  return {
    laptop,
    readyRack,
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

function addStacks<T extends Object3D>(params: {
  table: Group
  bases: Vector3[]
  perStack: number
  heightM: number
  create: (index: number) => T
}): T[] {
  const items: T[] = []
  for (const base of params.bases) {
    const stack: T[] = []
    for (let level = 0; level < params.perStack; level++) {
      const item = params.create(items.length + stack.length)
      item.position.copy(base)
      item.position.y += level * params.heightM
      params.table.add(item)
      stack.push(item)
    }
    // Take from the top of each stack, first stack first.
    items.push(...stack.reverse())
  }
  return items
}

function populatePackOutBench(table: Group) {
  const spots = PACK_OUT_BENCH_SPOTS
  const boxes: WhiteMailerBox[] = []
  addStacks({
    table,
    bases: spots.boxStacks,
    perStack: BOXES_PER_STACK,
    heightM: WHITE_MAILER_BOX.heightM + 0.004,
    create: () => {
      const box = createWhiteMailerBox()
      boxes.push(box)
      return box.group
    },
  })
  const boxesTopFirst = spots.boxStacks.flatMap((_, stackIndex) =>
    boxes
      .slice(stackIndex * BOXES_PER_STACK, (stackIndex + 1) * BOXES_PER_STACK)
      .reverse(),
  )
  const coils = addStacks({
    table,
    bases: spots.cableCoilStacks,
    perStack: COILS_PER_STACK,
    heightM: COILED_USB_CABLE.heightM,
    create: (index) => {
      const coil = createCoiledUsbCable()
      coil.rotation.y = index * 0.7
      return coil
    },
  })
  const chargers = addStacks({
    table,
    bases: spots.chargerStacks,
    perStack: CHARGERS_PER_STACK,
    heightM: USB_CHARGER.heightM,
    create: () => createUsbCharger().group,
  })
  const labelSheets: LabelSheet[] = []
  for (let level = 0; level < LABEL_SHEET_COUNT; level++) {
    const sheet = createLabelSheet()
    sheet.group.position.copy(spots.labelSheets)
    sheet.group.position.y +=
      (LABEL_SHEET_COUNT - 1 - level) * LABEL_SHEET_STACK_PITCH_M
    table.add(sheet.group)
    labelSheets.push(sheet)
  }
  const packingTote = createPackingTote()
  packingTote.group.position.copy(spots.tote)
  table.add(packingTote.group)
  return {
    boxes: boxesTopFirst,
    coils,
    chargers,
    labelSheets,
    packingTote,
  }
}

function populateShipReadyBench(table: Group): ShippingCarton {
  const carton = createShippingCarton()
  carton.group.position.copy(SHIP_READY_BENCH_SPOTS.carton)
  table.add(carton.group)
  return carton
}

function populatePrinterBench(table: Group) {
  const spots = PRINTER_BENCH_SPOTS
  const p2s = createBambuPrinter("P2S")
  p2s.group.position.copy(spots.p2s)
  const h2s = createBambuPrinter("H2S")
  h2s.group.position.copy(spots.h2s)
  table.add(p2s.group, h2s.group)
  // Both printers have just finished a full plate.
  for (const printer of [p2s, h2s]) populatePlate(printer)
  const emptyTubs: Group[] = []
  for (let level = 0; level < EMPTY_TUB_COUNT; level++) {
    const tub = createSpacerBasket(SPACER_TUB)
    tub.position.copy(spots.emptyTubs)
    tub.position.y += level * TUB_NESTING_M
    table.add(tub)
    emptyTubs.push(tub)
  }
  return { printers: [p2s, h2s], emptyTubs }
}

function populateLabelBench(table: Group): LabelPrinterState {
  const spots = LABEL_BENCH_SPOTS
  const printer = createInkjetPrinter()
  printer.position.copy(spots.inkjetPrinter)
  const outputStack = new Group()
  outputStack.position.copy(spots.printedSheets)
  const blankSheets = createBoxMesh({
    size: [LABEL_SHEET.widthM + 0.01, 0.05, LABEL_SHEET.lengthM + 0.01],
    material: createStandardMaterial({ color: 0xe8e2d4, roughness: 0.9 }),
    position: [spots.blankSheets.x, TOP + 0.025, spots.blankSheets.z],
  })
  table.add(printer, outputStack, blankSheets)
  return {
    group: printer,
    outputStack,
    printedSheets: [],
    activeFnskuSheet: null,
    secondsSinceLastSheet: 0,
  }
}

/** Build every bench and every part on it, in its starting state. */
export function createWorld(): ManufacturingWorld {
  const root = new Group()
  const tableIds = Object.keys(TABLE_PLACEMENTS) as TableId[]
  const tables = Object.fromEntries(
    tableIds.map((tableId) => [tableId, createPlacedTable(tableId)]),
  ) as Record<TableId, Group>
  for (const table of Object.values(tables)) root.add(table)
  const assemblyBench = populateAssemblyBench(tables.assembly_bench)
  const qcBench = populateQcBench(tables.qc_bench)
  const packOutBench = populatePackOutBench(tables.pack_out_bench)
  const carton = populateShipReadyBench(tables.ship_ready_bench)
  const printerBench = populatePrinterBench(tables.printer_bench)
  const labelPrinter = populateLabelBench(tables.label_bench)
  const units: AssemblyUnit[] = []
  for (let unitIndex = 0; unitIndex < BATCH_SIZE; unitIndex++) {
    units.push({
      stage: "raw",
      nextStepIndex: 0,
      motor: assemblyBench.motors[unitIndex],
      pcb: assemblyBench.pcbs[unitIndex],
      spacer: null,
      longScrews: [],
      motorCable: null,
      box: packOutBench.boxes[unitIndex],
      usbCables: [
        packOutBench.coils[unitIndex * 2],
        packOutBench.coils[unitIndex * 2 + 1],
      ],
      charger: packOutBench.chargers[unitIndex],
      label: null,
      fnskuLabel: null,
    })
    assemblyBench.motorFoamStand.occupants[unitIndex] = unitIndex
  }
  const cables = [qcBench.qcDataCable.cable, qcBench.qcPowerCable.cable]
  for (const cable of cables) root.add(cable.wire)
  root.updateMatrixWorld(true)
  return {
    root,
    tables,
    units,
    motorFoamStand: assemblyBench.motorFoamStand,
    finishedRack: assemblyBench.finishedRack,
    readyRack: qcBench.readyRack,
    spacerBasket: assemblyBench.spacerBasket,
    spacerStock: assemblyBench.spacerStock,
    screwdriver: assemblyBench.screwdriver,
    longScrewBin: assemblyBench.longScrewBin,
    usedScrewBin: assemblyBench.usedScrewBin,
    cableBin: assemblyBench.cableBin,
    removedStockScrews: [],
    isCartonShipped: false,
    laptop: qcBench.laptop,
    qcDataCable: qcBench.qcDataCable,
    qcPowerCable: qcBench.qcPowerCable,
    labelSheets: packOutBench.labelSheets,
    fnskuLabelSheets: [],
    packingTote: packOutBench.packingTote,
    carton,
    printers: printerBench.printers,
    emptyTubs: printerBench.emptyTubs,
    usedTubs: [],
    carriedTub: null,
    tubSpacers: [],
    labelPrinter,
    cables,
  }
}
