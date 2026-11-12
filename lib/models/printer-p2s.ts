import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Object3D } from "three"
import {
  createBoxMesh,
  createCylinderMesh,
  createStandardMaterial,
} from "lib/scene/primitives"
import {
  BLACK_PLASTIC_MATERIAL,
  DARK_METAL_MATERIAL,
  STEEL_MATERIAL,
} from "lib/scene/shared-materials"

/** Approximate outer size of a Bambu Lab P2S enclosed printer. */
export const PRINTER_P2S = {
  widthM: 0.392,
  heightM: 0.478,
  depthM: 0.406,
  doorHeightM: 0.36,
  baseHeightM: 0.07,
  buildPlateTopYM: 0.119,
} as const

export interface PrinterP2s {
  group: Group
  /** Hinged on its left edge. Rotate `rotation.y` negative to open. */
  door: Group
  doorHandle: Object3D
  buildPlate: Object3D
}

/** Simplified P2S-style enclosed CoreXY printer. Origin on the table, front is +Z. */
export function createPrinterP2s(): PrinterP2s {
  const group = new Group()
  const { widthM: w, heightM: h, depthM: d } = PRINTER_P2S
  const body = createStandardMaterial({ color: 0x25282c, roughness: 0.55 })
  const glass = createStandardMaterial({
    color: 0x9fc4d8,
    transparent: true,
    opacity: 0.16,
    roughness: 0.1,
    depthWrite: false,
  })
  const sidePanelHeightM = h - 0.1
  group.add(
    createBoxMesh({
      size: [w, PRINTER_P2S.baseHeightM, d],
      material: body,
      position: [0, 0.035, 0],
    }),
    createBoxMesh({
      size: [w, 0.03, d],
      material: body,
      position: [0, h - 0.015, 0],
    }),
    createBoxMesh({
      size: [w, sidePanelHeightM, 0.012],
      material: body,
      position: [0, h / 2 + 0.02, -d / 2 + 0.006],
    }),
    createBoxMesh({
      size: [0.012, sidePanelHeightM, d],
      material: body,
      position: [-w / 2 + 0.006, h / 2 + 0.02, 0],
    }),
    createBoxMesh({
      size: [0.012, sidePanelHeightM, d],
      material: body,
      position: [w / 2 - 0.006, h / 2 + 0.02, 0],
    }),
    createBoxMesh({
      size: [w, 0.045, 0.012],
      material: body,
      position: [0, h - 0.052, d / 2 - 0.006],
    }),
    createBoxMesh({
      size: [0.07, 0.03, 0.004],
      material: new MeshBasicMaterial({ color: 0x2ad1a3 }),
      position: [0.13, h - 0.052, d / 2 + 0.001],
    }),
    // build plate
    createBoxMesh({
      size: [0.27, 0.012, 0.27],
      material: DARK_METAL_MATERIAL,
      position: [0, 0.108, 0],
    }),
    createBoxMesh({
      size: [0.256, 0.004, 0.256],
      material: createStandardMaterial({
        color: 0x8a6f2a,
        roughness: 0.9,
        metalness: 0.3,
      }),
      position: [0, 0.117, 0],
    }),
    // gantry rod, toolhead and chamber light
    createBoxMesh({
      size: [0.06, 0.07, 0.055],
      material: DARK_METAL_MATERIAL,
      position: [0.02, h - 0.105, -0.02],
    }),
    createBoxMesh({
      size: [w - 0.03, 0.004, 0.01],
      material: new MeshBasicMaterial({ color: 0xfff3d0 }),
      position: [0, h - 0.033, d / 2 - 0.02],
    }),
  )
  const gantryRod = createCylinderMesh({
    radiusTopM: 0.005,
    radiusBottomM: 0.005,
    heightM: 0.37,
    material: STEEL_MATERIAL,
    position: [0, h - 0.09, -0.02],
  })
  gantryRod.rotation.z = Math.PI / 2
  group.add(gantryRod)

  const buildPlate = new Object3D()
  buildPlate.position.set(0.035, PRINTER_P2S.buildPlateTopYM, 0.11)
  group.add(buildPlate)

  const door = new Group()
  door.position.set(-w / 2 + 0.004, PRINTER_P2S.baseHeightM, d / 2 + 0.003)
  group.add(door)
  const doorWidthM = w - 0.008
  const pane = new Mesh(
    new BoxGeometry(doorWidthM, PRINTER_P2S.doorHeightM, 0.004),
    glass,
  )
  pane.position.set(doorWidthM / 2, PRINTER_P2S.doorHeightM / 2, 0)
  door.add(
    pane,
    createBoxMesh({
      size: [doorWidthM, 0.012, 0.006],
      material: body,
      position: [doorWidthM / 2, 0.006, 0],
    }),
    createBoxMesh({
      size: [doorWidthM, 0.012, 0.006],
      material: body,
      position: [doorWidthM / 2, PRINTER_P2S.doorHeightM - 0.006, 0],
    }),
    createBoxMesh({
      size: [0.012, 0.09, 0.014],
      material: BLACK_PLASTIC_MATERIAL,
      position: [w - 0.03, 0.2, 0.008],
    }),
  )
  const doorHandle = new Object3D()
  doorHandle.position.set(w - 0.03, 0.2, 0.016)
  door.add(doorHandle)

  return { group, door, doorHandle, buildPlate }
}
