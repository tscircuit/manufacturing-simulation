import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from "three"
import {
  createBackfaceSpacer,
  BACKFACE_SPACER,
} from "lib/models/backface-spacer"
import {
  createBoxMesh,
  createCylinderMesh,
  createStandardMaterial,
} from "lib/scene/primitives"
import { DARK_METAL_MATERIAL, STEEL_MATERIAL } from "lib/scene/shared-materials"

export type BambuModel = "P2S" | "H2S"

/** Spacing between spacers on the plate: the 42 mm face plus a 4-6 mm gap. */
export interface BambuPrinterSpec {
  widthM: number
  depthM: number
  heightM: number
  bedWidthM: number
  bedDepthM: number
  spacerPitchM: number
  /** Estimated time to print a full plate of spacers. */
  estimatedPlateSeconds: number
}

/**
 * Outer size and build plate of each printer. Spacers per plate is the most
 * 42 x 42 mm spacers that fit on the bed at the given pitch: 5 x 5 = 25 on
 * the P2S (256 x 256 mm bed) and 7 x 7 = 49 on the H2S (340 x 320 mm bed).
 * Plate times are estimates for ~2.6 g PLA spacers, not slicer output.
 */
export const BAMBU_PRINTERS: Record<BambuModel, BambuPrinterSpec> = {
  P2S: {
    widthM: 0.392,
    depthM: 0.406,
    heightM: 0.478,
    bedWidthM: 0.256,
    bedDepthM: 0.256,
    spacerPitchM: 0.048,
    estimatedPlateSeconds: 2 * 3600 + 10 * 60,
  },
  H2S: {
    widthM: 0.492,
    depthM: 0.514,
    heightM: 0.626,
    bedWidthM: 0.34,
    bedDepthM: 0.32,
    spacerPitchM: 0.046,
    estimatedPlateSeconds: 4 * 3600,
  },
}

export function getSpacerGrid(model: BambuModel): {
  columns: number
  rows: number
} {
  const spec = BAMBU_PRINTERS[model]
  return {
    columns:
      Math.floor(
        (spec.bedWidthM - BACKFACE_SPACER.faceSizeM) / spec.spacerPitchM,
      ) + 1,
    rows:
      Math.floor(
        (spec.bedDepthM - BACKFACE_SPACER.faceSizeM) / spec.spacerPitchM,
      ) + 1,
  }
}

export function getSpacersPerPlate(model: BambuModel): number {
  const { columns, rows } = getSpacerGrid(model)
  return columns * rows
}

export interface BambuPrinter {
  model: BambuModel
  group: Group
  /** Hinged on its left edge. Rotate `rotation.y` negative to open. */
  door: Group
  doorHandle: Object3D
  /** Removable PEI plate; spacers print on top of it. */
  plate: Group
  /** Where the plate sits on the bed, in printer coordinates. */
  plateHome: Vector3
  plateSpacers: Group[]
  /** Status light on the front: green when a plate is ready, blue while printing. */
  statusLight: Mesh<BoxGeometry, MeshBasicMaterial>
  isPrinting: boolean
  printedSeconds: number
}

export const PRINTER_STATUS_COLORS = {
  ready: 0x2ad1a3,
  printing: 0x4aa3ff,
} as const

const BED_HEIGHT_M = 0.12

/** Fill the plate with a full set of freshly printed spacers. */
export function populatePlate(printer: BambuPrinter): void {
  const spec = BAMBU_PRINTERS[printer.model]
  const { columns, rows } = getSpacerGrid(printer.model)
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const spacer = createBackfaceSpacer()
      spacer.position.set(
        (column - (columns - 1) / 2) * spec.spacerPitchM,
        0.002,
        (row - (rows - 1) / 2) * spec.spacerPitchM,
      )
      printer.plate.add(spacer)
      printer.plateSpacers.push(spacer)
    }
  }
}

export function createBambuPrinter(model: BambuModel): BambuPrinter {
  const spec = BAMBU_PRINTERS[model]
  const group = new Group()
  const { widthM: w, depthM: d, heightM: h } = spec
  const body = createStandardMaterial({
    color: model === "H2S" ? 0xd9dcdf : 0x25282c,
    roughness: 0.55,
  })
  const trim = createStandardMaterial({ color: 0x1c1e21, roughness: 0.6 })
  const glass = createStandardMaterial({
    color: 0x9fc4d8,
    transparent: true,
    opacity: 0.16,
    roughness: 0.1,
    depthWrite: false,
  })
  const sideHeightM = h - 0.1
  group.add(
    createBoxMesh({
      size: [w, 0.07, d],
      material: body,
      position: [0, 0.035, 0],
    }),
    createBoxMesh({
      size: [w, 0.03, d],
      material: body,
      position: [0, h - 0.015, 0],
    }),
    createBoxMesh({
      size: [w, sideHeightM, 0.012],
      material: body,
      position: [0, h / 2 + 0.02, -d / 2 + 0.006],
    }),
    createBoxMesh({
      size: [0.012, sideHeightM, d],
      material: body,
      position: [-w / 2 + 0.006, h / 2 + 0.02, 0],
    }),
    createBoxMesh({
      size: [0.012, sideHeightM, d],
      material: body,
      position: [w / 2 - 0.006, h / 2 + 0.02, 0],
    }),
    createBoxMesh({
      size: [w, 0.045, 0.012],
      material: trim,
      position: [0, h - 0.052, d / 2 - 0.006],
    }),
    // Bed carrier and gantry
    createBoxMesh({
      size: [spec.bedWidthM + 0.014, 0.012, spec.bedDepthM + 0.014],
      material: DARK_METAL_MATERIAL,
      position: [0, BED_HEIGHT_M - 0.006, 0],
    }),
    createBoxMesh({
      size: [0.06, 0.07, 0.055],
      material: DARK_METAL_MATERIAL,
      position: [0.02, h - 0.11, -0.02],
    }),
    createBoxMesh({
      size: [w - 0.04, 0.004, 0.01],
      material: new MeshBasicMaterial({ color: 0xfff3d0 }),
      position: [0, h - 0.035, d / 2 - 0.02],
    }),
  )
  const rod = createCylinderMesh({
    radiusTopM: 0.005,
    radiusBottomM: 0.005,
    heightM: w - 0.03,
    material: STEEL_MATERIAL,
    position: [0, h - 0.09, -0.02],
  })
  rod.rotation.z = Math.PI / 2
  group.add(rod)
  const statusLight = new Mesh(
    new BoxGeometry(0.06, 0.02, 0.004),
    new MeshBasicMaterial({ color: PRINTER_STATUS_COLORS.ready }),
  )
  statusLight.position.set(w / 2 - 0.07, h - 0.052, d / 2 + 0.001)
  group.add(statusLight)

  const plateHome = new Vector3(0, BED_HEIGHT_M, 0)
  const plate = new Group()
  plate.position.copy(plateHome)
  plate.add(
    createBoxMesh({
      size: [spec.bedWidthM, 0.002, spec.bedDepthM],
      material: createStandardMaterial({
        color: 0x8a6f2a,
        roughness: 0.9,
        metalness: 0.3,
      }),
      position: [0, 0.001, 0],
    }),
    createBoxMesh({
      size: [0.05, 0.002, 0.02],
      material: trim,
      position: [0, 0.001, spec.bedDepthM / 2 + 0.01],
    }),
  )
  group.add(plate)

  const door = new Group()
  door.position.set(-w / 2 + 0.004, 0.07, d / 2 + 0.003)
  group.add(door)
  const doorWidthM = w - 0.008
  const doorHeightM = h - 0.13
  const pane = new Mesh(new BoxGeometry(doorWidthM, doorHeightM, 0.004), glass)
  pane.position.set(doorWidthM / 2, doorHeightM / 2, 0)
  door.add(
    pane,
    createBoxMesh({
      size: [doorWidthM, 0.012, 0.006],
      material: trim,
      position: [doorWidthM / 2, 0.006, 0],
    }),
    createBoxMesh({
      size: [doorWidthM, 0.012, 0.006],
      material: trim,
      position: [doorWidthM / 2, doorHeightM - 0.006, 0],
    }),
    createBoxMesh({
      size: [0.012, 0.09, 0.014],
      material: trim,
      position: [doorWidthM - 0.025, doorHeightM * 0.55, 0.008],
    }),
  )
  const doorHandle = new Object3D()
  doorHandle.position.set(doorWidthM - 0.025, doorHeightM * 0.55, 0.016)
  door.add(doorHandle)

  const printer: BambuPrinter = {
    model,
    group,
    door,
    doorHandle,
    plate,
    plateHome,
    plateSpacers: [],
    statusLight,
    isPrinting: false,
    printedSeconds: 0,
  }
  return printer
}
