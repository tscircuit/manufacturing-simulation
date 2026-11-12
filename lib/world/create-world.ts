import { Group, Mesh, TorusGeometry } from "three"
import {
  FOLDING_TABLE,
  PRINTER_ON_TABLE,
  TABLE_PLACEMENTS,
  type TableId,
} from "lib/layout/station-layout"
import { createBackfaceSpacer } from "lib/models/backface-spacer"
import { createControllerPcb } from "lib/models/controller-pcb"
import { createFilamentSpool } from "lib/models/filament-spool"
import { createFoamCuttingStation } from "lib/models/foam-cutting-station"
import { createFoamInsert } from "lib/models/foam-insert"
import { createFoldingTable } from "lib/models/folding-table"
import { createMailerBox, type MailerBox } from "lib/models/mailer-box"
import { createNema17Motor, type Nema17Motor } from "lib/models/nema17-motor"
import {
  createPrinterP2s,
  PRINTER_P2S,
  type PrinterP2s,
} from "lib/models/printer-p2s"
import { createScrewdriver, type Screwdriver } from "lib/models/screwdriver"
import {
  createBoxMesh,
  createCircleHole,
  createCylinderMesh,
  createExtrudedMesh,
  createRectangleShape,
  createStandardMaterial,
} from "lib/scene/primitives"
import { BLACK_PLASTIC_MATERIAL } from "lib/scene/shared-materials"
import {
  ASSEMBLY_BENCH_SPOTS,
  PACK_OUT_BENCH_SPOTS,
  SCREWDRIVER_REST_QUATERNION,
} from "lib/world/bench-spots"

/**
 * Everything movable on the floor. The `motor`, `pcb`, `spacer`, `box` and
 * foam fields are the units used by the current job; the rest of each stack
 * is scenery.
 */
export interface ManufacturingWorld {
  root: Group
  tables: Record<TableId, Group>
  printer: PrinterP2s
  spacer: Group
  motor: Nema17Motor
  pcb: Group
  screwdriver: Screwdriver
  box: MailerBox
  foamCutting: ReturnType<typeof createFoamCuttingStation>
  foamInsertPair: Group
  bottomFoam: Group
  topFoam: Group
  /** Backface screws set aside in the dish, in removal order. */
  screwsInDish: Group[]
}

const MOTORS_IN_TRAY = 4
const PCBS_IN_STACK = 5
const BOX_BLANKS_IN_STACK = 4
const JIG_HEIGHT_M = 0.03

const SPACER_PRINT_POSITIONS: Array<[number, number]> = [
  [0.035, 0.11],
  [-0.035, 0.11],
  [0.035, 0.05],
  [-0.035, 0.05],
]

function populateAssemblyBench(table: Group): {
  motor: Nema17Motor
  pcb: Group
  screwdriver: Screwdriver
} {
  const spots = ASSEMBLY_BENCH_SPOTS
  const fixtureMaterial = createStandardMaterial({ color: 0x4d5a66 })

  const jig = createRectangleShape({ widthM: 0.07, depthM: 0.07 })
  jig.holes.push(createCircleHole({ x: 0, y: 0, radiusM: 0.012 }))
  const jigMesh = createExtrudedMesh({
    shape: jig,
    depthM: JIG_HEIGHT_M,
    material: fixtureMaterial,
    baseYM: spots.jigTop.y - JIG_HEIGHT_M,
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
    baseYM: spots.motorTrayCenter.y,
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
      spots.motorTrayCenter.y + JIG_HEIGHT_M,
      spots.motorTrayCenter.z,
    )
    table.add(motor.group)
    motors.push(motor)
  }

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
  const pcbs: Group[] = []
  for (let level = 0; level < PCBS_IN_STACK; level++) {
    const pcb = createControllerPcb()
    pcb.position.copy(spots.pcbStackBase)
    pcb.position.y += level * spots.pcbStackSpacingM
    table.add(pcb)
    pcbs.push(pcb)
  }

  const dishMaterial = createStandardMaterial({ color: 0x2f6fb0 })
  const dish = new Group()
  dish.position.copy(spots.screwDish)
  const rim = new Mesh(new TorusGeometry(0.035, 0.0025, 8, 32), dishMaterial)
  rim.position.y = 0.004
  rim.rotation.x = Math.PI / 2
  dish.add(
    createCylinderMesh({
      radiusTopM: 0.036,
      radiusBottomM: 0.032,
      heightM: 0.002,
      material: dishMaterial,
      position: [0, 0.001, 0],
      radialSegments: 28,
    }),
    rim,
  )
  table.add(dish)

  const screwdriver = createScrewdriver()
  screwdriver.group.position.copy(spots.screwdriverRest)
  screwdriver.group.quaternion.copy(SCREWDRIVER_REST_QUATERNION)
  table.add(screwdriver.group)

  return {
    motor: motors[MOTORS_IN_TRAY - 1],
    pcb: pcbs[PCBS_IN_STACK - 1],
    screwdriver,
  }
}

function populatePrinterBench(table: Group): {
  printer: PrinterP2s
  spacer: Group
} {
  const printer = createPrinterP2s()
  printer.group.position.set(
    PRINTER_ON_TABLE.alongTableM,
    FOLDING_TABLE.topHeightM,
    PRINTER_ON_TABLE.depthOffsetM,
  )
  table.add(printer.group)
  const spacers = SPACER_PRINT_POSITIONS.map(([x, z]) => {
    const spacer = createBackfaceSpacer()
    spacer.position.set(x, PRINTER_P2S.buildPlateTopYM, z)
    printer.group.add(spacer)
    return spacer
  })
  const spoolColors = [0xf07a1c, 0x2e7d5b]
  for (const [index, filamentColor] of spoolColors.entries()) {
    const spool = createFilamentSpool({ filamentColor })
    spool.position.set(
      0.35 + index * 0.23,
      printer.group.position.y + 0.1,
      -0.05,
    )
    table.add(spool)
  }
  return { printer, spacer: spacers[0] }
}

function populatePackOutBench(table: Group): MailerBox {
  const spots = PACK_OUT_BENCH_SPOTS
  const boxes: MailerBox[] = []
  for (let level = 0; level < BOX_BLANKS_IN_STACK; level++) {
    const box = createMailerBox()
    box.group.position.copy(spots.boxBlankStack)
    box.group.position.y += level * spots.boxBlankSpacingM
    table.add(box.group)
    boxes.push(box)
  }
  table.add(
    createBoxMesh({
      size: [0.3, 0.002, 0.24],
      material: createStandardMaterial({ color: 0x2e7d5b, roughness: 0.9 }),
      position: [
        spots.finishedGoods.x + 0.04,
        spots.finishedGoods.y + 0.001,
        spots.finishedGoods.z - 0.02,
      ],
    }),
  )
  return boxes[BOX_BLANKS_IN_STACK - 1]
}

function createPlacedTable(tableId: TableId): Group {
  const placement = TABLE_PLACEMENTS[tableId]
  const table = createFoldingTable()
  table.name = tableId
  table.position.set(placement.centerXM, 0, placement.centerZM)
  table.rotation.y = placement.ccwYawRadians
  return table
}

/** Build the benches and every part on them, in their starting state. */
export function createWorld(): ManufacturingWorld {
  const root = new Group()
  const tables: Record<TableId, Group> = {
    assembly_bench: createPlacedTable("assembly_bench"),
    printer_bench: createPlacedTable("printer_bench"),
    foam_cutting_bench: createPlacedTable("foam_cutting_bench"),
    pack_out_bench: createPlacedTable("pack_out_bench"),
  }
  root.add(...Object.values(tables))
  const assemblyBench = populateAssemblyBench(tables.assembly_bench)
  const printerBench = populatePrinterBench(tables.printer_bench)
  const box = populatePackOutBench(tables.pack_out_bench)
  const foamCutting = createFoamCuttingStation()
  foamCutting.group.position.y = FOLDING_TABLE.topHeightM
  tables.foam_cutting_bench.add(foamCutting.group)
  const foamInsertPair = new Group()
  foamInsertPair.name = "foam-insert-pair"
  root.updateMatrixWorld(true)
  return {
    root,
    tables,
    ...assemblyBench,
    ...printerBench,
    box,
    foamCutting,
    foamInsertPair,
    bottomFoam: createFoamInsert({ isTopInsert: false }),
    topFoam: createFoamInsert({ isTopInsert: true }),
    screwsInDish: [],
  }
}
