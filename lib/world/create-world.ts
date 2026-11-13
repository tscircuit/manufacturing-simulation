import type { ProductLine } from "lib/job/job-plan"
import { MOTOR_IN_CRADLE_POSITION } from "lib/job/unit-poses"
import {
  BARE_UNIT_TABLE_LAYOUT,
  BATCH_SIZE,
  KIT_TABLE_LAYOUT,
  STATIONS,
  type Station,
  TABLE_PLACEMENTS,
  type TableId,
  type TablePlacement,
  WORK_TABLE,
} from "lib/layout/station-layout"
import { createBackfaceSpacer } from "lib/models/backface-spacer"
import {
  type BambuPrinter,
  createBambuPrinter,
  populatePlate,
} from "lib/models/bambu-printer"
import { createBoardTray } from "lib/models/board-tray"
import { createCoiledJstCable } from "lib/models/coiled-jst-cable"
import {
  COILED_USB_CABLE,
  createCoiledUsbCable,
} from "lib/models/coiled-usb-cable"
import {
  type ControllerPcb,
  createControllerPcb,
} from "lib/models/controller-pcb"
import { createEsdBag, ESD_BAG, type EsdBag } from "lib/models/esd-bag"
import { createFlexCable, type FlexCable } from "lib/models/flex-cable"
import { createInkjetPrinter } from "lib/models/inkjet-printer"
import {
  createLabelSheet,
  FNSKU_LABEL_SHEET,
  LABEL_SHEET,
  type LabelSheet,
  type LabelSheetSpec,
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
import type { PartKit } from "lib/models/part-kit"
import { createPartsBin, PARTS_BIN } from "lib/models/parts-bin"
import { type CablePlug, createJstPlug, createUsbCPlug } from "lib/models/plugs"
import { createQcCradle } from "lib/models/qc-cradle"
import { createQcLaptop, type QcLaptop } from "lib/models/qc-laptop"
import type { ScrewPouch } from "lib/models/screw-pouch"
import { createScrewdriver, type Screwdriver } from "lib/models/screwdriver"
import {
  BAG_SHIPPING_CARTON,
  type CartonSpec,
  createShippingCarton,
  SHIPPING_CARTON,
  type ShippingCarton,
} from "lib/models/shipping-carton"
import {
  ASSEMBLY_SPACER_BASKET,
  createSpacerBasket,
  getSpacerPilePosition,
  SPACER_TUB,
} from "lib/models/spacer-basket"
import { createStandingDesk } from "lib/models/standing-desk"
import { createSticker } from "lib/models/sticker"
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
import { METERS_PER_INCH } from "lib/units"
import {
  ASSEMBLY_BENCH_SPOTS,
  BAG_LYING_QUATERNION,
  BAGGING_BENCH_SPOTS,
  LABEL_BENCH_SPOTS,
  MOTOR_ON_SIDE_QUATERNION,
  PACK_OUT_BENCH_SPOTS,
  PLUG_LYING_QUATERNION,
  PRINTER_BENCH_SPOTS,
  QC_BENCH_SPOTS,
  SCREW_LYING_QUATERNION,
  SCREWDRIVER_REST_QUATERNION,
  SHIP_READY_BENCH_SPOTS,
} from "lib/world/bench-spots"
import { Group, Matrix4, type Object3D, Vector3 } from "three"

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
  /** Bare-unit line: the ESD bag it ships in, and the FNSKU label on the bag. */
  bag: EsdBag | null
  fnskuLabel: Group | null
  /** Bare-unit line: where the spacer, board, cable and screw pouch lie in the bag. */
  kit: PartKit | null
  /** Bare-unit line: the pink pouch the four screws go in. */
  screwPouch: ScrewPouch | null
}

/** The label printer on the label bench, printing AveneMark sheets onto its output stack. */
export interface LabelPrinterState {
  group: Group
  outputStack: Group
  /** Printed sheets waiting in the output tray, bottom first. */
  printedSheets: LabelSheet[]
  secondsSinceLastSheet: number
}

/** Everything movable on the floor. */
export interface ManufacturingWorld {
  /** The full kit, or the bare unit in an ESD bag. */
  productLine: ProductLine
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
  /** Bare-unit line: Amazon FNSKU label sheets at the bagging bench, top first. */
  fnskuSheets: LabelSheet[]
  /** Bare-unit line: the FBA box ID label, put on the carton's side before sealing. */
  boxIdLabel: Group | null
  /** Where the printers' spacers are poured: the assembly bench, or the bagging bench on the bare-unit line. */
  spacerHome: {
    station: Station
    basketSpot: Vector3
    usedTubSpot: Vector3
  }
  /** Bare-unit line: the one motor kept at QC to spin-test each board, and its cable to the board. */
  testMotor: Nema17Motor | null
  testMotorCable: MotorCable | null
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

function createPlacedTable(params: {
  tableId: TableId
  placement: TablePlacement | undefined
}): Group {
  const { tableId } = params
  const placement = params.placement ?? TABLE_PLACEMENTS[tableId]
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

/**
 * `isKitting`: the bare-unit line has no motors at this bench. The foam stand
 * stays (hidden) as the queue of units still to kit, and the motors are made
 * but never put on the bench.
 */
function populateAssemblyBench(table: Group, isKitting = false) {
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
    if (!isKitting) motorFoamStand.group.add(motor.group)
    return motor
  })
  motorFoamStand.group.visible = !isKitting
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
    sheet.group.position.y += (LABEL_SHEET_COUNT - 1 - level) * 0.0006
    table.add(sheet.group)
    labelSheets.push(sheet)
  }
  // Peel from the front row first.
  for (const sheet of labelSheets) sheet.labels.reverse()
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

function populateShipReadyBench(
  table: Group,
  spec: CartonSpec = SHIPPING_CARTON,
): ShippingCarton {
  const carton = createShippingCarton(spec)
  carton.group.position.copy(SHIP_READY_BENCH_SPOTS.carton)
  table.add(carton.group)
  return carton
}

/**
 * Bare-unit line: the one motor kept at QC, lying in the cradle, with its
 * own cable plugged into its socket and the board end resting on the bench.
 * Each board is spin-tested on it.
 */
function addQcTestMotor(table: Group): {
  motor: Nema17Motor
  cable: MotorCable
} {
  const motor = createNema17Motor()
  table.add(motor.group)
  motor.group.position.copy(MOTOR_IN_CRADLE_POSITION)
  motor.group.quaternion.copy(MOTOR_ON_SIDE_QUATERNION)
  const motorPlug = createJstPlug({ pinCount: 6 })
  motor.group.add(motorPlug.group)
  motorPlug.group.position.copy(motor.cableSocket.position)
  motorPlug.group.quaternion.copy(motor.cableSocket.quaternion)
  const boardPlug = createJstPlug({ pinCount: 4 })
  table.add(boardPlug.group)
  boardPlug.group.position.copy(QC_TEST_PLUG_REST)
  boardPlug.group.quaternion.copy(PLUG_LYING_QUATERNION)
  const cable = createFlexCable({
    startAnchor: motorPlug.wireAnchor,
    endAnchor: boardPlug.wireAnchor,
    color: 0x1f2226,
    radiusM: 0.0012,
    minYM: TOP + 0.004,
    slackOffset: new Vector3(0, 0.02, 0.04),
    leadLengthM: 0.012,
  })
  cable.slackFrame = table
  return { motor, cable: { cable, motorPlug, boardPlug } }
}

/** Where the test motor's board plug rests between tests, beside the cradle. */
export const QC_TEST_PLUG_REST = new Vector3(
  QC_BENCH_SPOTS.cradle.x + 0.09,
  TOP + 0.0031,
  QC_BENCH_SPOTS.cradle.z + 0.06,
)

/** Where each board lies beside the test motor while it is tested, on an ESD mat. */
export const BOARD_TEST_SPOT = new Vector3(
  QC_BENCH_SPOTS.cradle.x + 0.08,
  TOP + 0.0012,
  QC_BENCH_SPOTS.cradle.z + 0.02,
)

/**
 * Bare-unit line: boards start in an untested ESD tray on the QC bench and
 * go to a passed tray after the spin test; the spacer basket, long-screw bin
 * and cable bin move to the bagging bench with a box of screw pouches.
 */
function setUpBareUnitBenches(params: {
  qcBench: Group
  baggingBench: Group
  assemblyBench: ReturnType<typeof populateAssemblyBench>
  kitReadyRack: MotorRack
}): { untested: MotorRack; passed: MotorRack } {
  const { qcBench, baggingBench, assemblyBench } = params
  qcBench.remove(params.kitReadyRack.group)
  const untested = createBoardTray({ rimColor: 0xd9a400 })
  untested.group.position.copy(QC_BENCH_SPOTS.incomingRack)
  const passed = createBoardTray({ rimColor: 0x1d9f5a })
  passed.group.position.copy(QC_BENCH_SPOTS.readyRack)
  qcBench.add(untested.group, passed.group)
  for (const [index, pcb] of assemblyBench.pcbs.entries()) {
    untested.group.add(pcb.group)
    pcb.group.position.copy(untested.slots[index].position)
    pcb.group.quaternion.identity()
  }
  // ESD mat the board lies on next to the test motor.
  qcBench.add(
    createBoxMesh({
      size: [0.12, 0.0012, 0.1],
      material: createStandardMaterial({ color: 0x3a6e9a, roughness: 0.9 }),
      position: [BOARD_TEST_SPOT.x, TOP + 0.0006, BOARD_TEST_SPOT.z],
    }),
  )
  const spots = BAGGING_BENCH_SPOTS
  for (const [object, spot] of [
    [assemblyBench.spacerBasket, spots.spacerBasket],
    [assemblyBench.longScrewBin, spots.longScrewBin],
    [assemblyBench.cableBin, spots.cableBin],
  ] as const) {
    baggingBench.add(object)
    object.position.copy(spot)
  }
  // Open box of flat pink screw pouches.
  const box = new Group()
  box.position.copy(spots.pouchBox)
  const cardboard = createStandardMaterial({ color: 0xc49a6c, roughness: 0.95 })
  box.add(
    createBoxMesh({
      size: [0.07, 0.03, 0.09],
      material: cardboard,
      position: [0, 0.015, 0],
    }),
    createBoxMesh({
      size: [0.056, 0.012, 0.08],
      material: createStandardMaterial({ color: 0xf3a1c0, roughness: 0.4 }),
      position: [0, 0.025, 0],
    }),
  )
  baggingBench.add(box)
  return { untested, passed }
}

/** Bare-unit line: 4" x 6" FBA box ID label waiting (unseen) on the carton's long side. */
function addBoxIdLabel(carton: ShippingCarton): Group {
  const spec = BAG_SHIPPING_CARTON
  const outerWidthM = spec.innerWidthM + 2 * spec.boardThicknessM
  const label = createSticker({
    widthM: 4 * METERS_PER_INCH,
    lengthM: 6 * METERS_PER_INCH,
    artwork: "fba_box",
  })
  label.position.set(0, spec.innerHeightM * 0.5, outerWidthM / 2 + 0.0004)
  // Printed face out of the side (+Z), the 6" side running along the carton.
  label.quaternion.setFromRotationMatrix(
    new Matrix4().makeBasis(
      new Vector3(0, 1, 0),
      new Vector3(0, 0, 1),
      new Vector3(1, 0, 0),
    ),
  )
  label.visible = false
  carton.group.add(label)
  return label
}

const BAGS_IN_TRAY = BATCH_SIZE + 6
const FNSKU_SHEET_COUNT = 2

/** Kit parts the bare unit doesn't ship with: made, never put on a bench. */
function createUnusedKitParts() {
  return {
    boxes: Array.from({ length: BATCH_SIZE }, () => createWhiteMailerBox()),
    coils: Array.from({ length: BATCH_SIZE * 2 }, () => createCoiledUsbCable()),
    chargers: Array.from(
      { length: BATCH_SIZE },
      () => createUsbCharger().group,
    ),
  }
}

/**
 * Pack-out bench for bare units: flat ESD bags in a tray, a printed bag holder,
 * the original 2" x 4" tscircuit label sheets, FNSKU sheets and the tote.
 */
function populateBaggingBench(table: Group) {
  const spots = BAGGING_BENCH_SPOTS
  const tray = new Group()
  tray.position.copy(spots.bagTray)
  const cardboard = createStandardMaterial({ color: 0xc49a6c, roughness: 0.95 })
  const trayWidthM = ESD_BAG.widthM + 0.02
  const trayLengthM = ESD_BAG.heightM + 0.02
  tray.add(
    createBoxMesh({
      size: [trayWidthM, 0.003, trayLengthM],
      material: cardboard,
      position: [0, 0.0015, 0],
    }),
  )
  for (const side of [-1, 1]) {
    tray.add(
      createBoxMesh({
        size: [0.003, 0.03, trayLengthM],
        material: cardboard,
        position: [side * (trayWidthM / 2), 0.015, 0],
      }),
      createBoxMesh({
        size: [trayWidthM, 0.03, 0.003],
        material: cardboard,
        position: [0, 0.015, side * (trayLengthM / 2)],
      }),
    )
  }
  table.add(tray)
  const bags: EsdBag[] = []
  for (let level = 0; level < BAGS_IN_TRAY; level++) {
    const bag = createEsdBag()
    bag.group.quaternion.copy(BAG_LYING_QUATERNION)
    // Lying front up with the opening toward the back of the bench.
    bag.group.position.set(0, 0.004 + level * 0.0007, ESD_BAG.heightM / 2)
    tray.add(bag.group)
    bags.push(bag)
  }
  // 3D-printed bag holder (from the P2S/H2S) that holds a bag upright and
  // open while the parts go in; kitchen baggy racks are too big for 80 mm bags.
  const wire = createStandardMaterial({ color: 0x3a3f45, roughness: 0.8 })
  const stand = new Group()
  stand.position.copy(spots.bagStand)
  stand.add(
    createBoxMesh({
      size: [ESD_BAG.widthM + 0.03, 0.006, 0.07],
      material: wire,
      position: [0, 0.003, 0],
    }),
  )
  for (const side of [-1, 1])
    stand.add(
      createBoxMesh({
        size: [0.004, 0.12, 0.004],
        material: wire,
        position: [side * (ESD_BAG.widthM / 2 + 0.008), 0.06, 0],
      }),
    )
  table.add(stand)

  const stackSheets = (params: {
    spec: LabelSheetSpec
    count: number
    position: Vector3
  }): LabelSheet[] => {
    const sheets: LabelSheet[] = []
    for (let level = 0; level < params.count; level++) {
      const sheet = createLabelSheet(params.spec)
      sheet.group.position.copy(params.position)
      sheet.group.position.y += (params.count - 1 - level) * 0.0006
      table.add(sheet.group)
      sheets.push(sheet)
    }
    // Peel from the front row first.
    for (const sheet of sheets) sheet.labels.reverse()
    return sheets
  }
  const packingTote = createPackingTote()
  packingTote.group.position.copy(spots.tote)
  table.add(packingTote.group)
  return {
    ...createUnusedKitParts(),
    // Take from the top of the pile.
    bags: bags.reverse(),
    labelSheets: stackSheets({
      spec: LABEL_SHEET,
      count: LABEL_SHEET_COUNT + 1,
      position: spots.stickerSheets,
    }),
    fnskuSheets: stackSheets({
      spec: FNSKU_LABEL_SHEET,
      count: FNSKU_SHEET_COUNT,
      position: spots.fnskuSheets,
    }),
    packingTote,
  }
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
    secondsSinceLastSheet: 0,
  }
}

/** Build every bench and every part on it, in its starting state. */
export function createWorld(
  params: { productLine?: ProductLine } = {},
): ManufacturingWorld {
  const productLine = params.productLine ?? "kit"
  const isBagged = productLine === "bagged"
  const root = new Group()
  const layout = isBagged ? BARE_UNIT_TABLE_LAYOUT : KIT_TABLE_LAYOUT
  const tableIds = Object.keys(TABLE_PLACEMENTS) as TableId[]
  const tables = Object.fromEntries(
    tableIds.map((tableId) => [
      tableId,
      createPlacedTable({ tableId, placement: layout[tableId] }),
    ]),
  ) as Record<TableId, Group>
  // A bench missing from the layout (the bare-unit line's assembly bench) is
  // built but left off the floor.
  for (const tableId of tableIds) if (layout[tableId]) root.add(tables[tableId])
  const assemblyBench = populateAssemblyBench(tables.assembly_bench, isBagged)
  const qcBench = populateQcBench(tables.qc_bench)
  const testFixture = isBagged ? addQcTestMotor(tables.qc_bench) : null
  const bareUnitTrays = isBagged
    ? setUpBareUnitBenches({
        qcBench: tables.qc_bench,
        baggingBench: tables.pack_out_bench,
        assemblyBench,
        kitReadyRack: qcBench.readyRack,
      })
    : null
  const packOutBench = isBagged
    ? populateBaggingBench(tables.pack_out_bench)
    : {
        ...populatePackOutBench(tables.pack_out_bench),
        bags: [],
        fnskuSheets: [],
      }
  const carton = populateShipReadyBench(
    tables.ship_ready_bench,
    isBagged ? BAG_SHIPPING_CARTON : SHIPPING_CARTON,
  )
  const boxIdLabel = isBagged ? addBoxIdLabel(carton) : null
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
      bag: packOutBench.bags[unitIndex] ?? null,
      fnskuLabel: null,
      kit: null,
      screwPouch: null,
    })
    assemblyBench.motorFoamStand.occupants[unitIndex] = unitIndex
    if (bareUnitTrays) bareUnitTrays.untested.occupants[unitIndex] = unitIndex
  }
  const cables = [qcBench.qcDataCable.cable, qcBench.qcPowerCable.cable]
  if (testFixture) cables.push(testFixture.cable.cable)
  for (const cable of cables) root.add(cable.wire)
  root.updateMatrixWorld(true)
  return {
    productLine,
    root,
    tables,
    units,
    motorFoamStand: assemblyBench.motorFoamStand,
    finishedRack: bareUnitTrays?.untested ?? assemblyBench.finishedRack,
    readyRack: bareUnitTrays?.passed ?? qcBench.readyRack,
    spacerHome: isBagged
      ? {
          station: STATIONS.packOut,
          basketSpot: BAGGING_BENCH_SPOTS.spacerBasket,
          usedTubSpot: BAGGING_BENCH_SPOTS.usedTubs,
        }
      : {
          station: STATIONS.assembly,
          basketSpot: ASSEMBLY_BENCH_SPOTS.spacerBasket,
          usedTubSpot: ASSEMBLY_BENCH_SPOTS.emptyTubs,
        },
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
    fnskuSheets: packOutBench.fnskuSheets,
    testMotor: testFixture?.motor ?? null,
    testMotorCable: testFixture?.cable ?? null,
    boxIdLabel,
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
