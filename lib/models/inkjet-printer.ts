import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { Group } from "three"

/** Epson EcoTank ET-2400, about 375 x 347 x 179 mm. Origin on the table; paper exits toward +Z. */
export const INKJET_PRINTER = {
  widthM: 0.375,
  depthM: 0.347,
  heightM: 0.179,
} as const

export function createInkjetPrinter(): Group {
  const printer = new Group()
  const { widthM, depthM, heightM } = INKJET_PRINTER
  const body = createStandardMaterial({ color: 0x24272b, roughness: 0.55 })
  printer.add(
    createBoxMesh({
      size: [widthM, heightM, depthM],
      material: body,
      position: [0, heightM / 2, 0],
    }),
    createBoxMesh({
      size: [widthM - 0.03, 0.006, depthM - 0.05],
      material: createStandardMaterial({ color: 0x31353a, roughness: 0.4 }),
      position: [0, heightM + 0.003, -0.01],
    }),
    // Ink tanks on the front right
    createBoxMesh({
      size: [0.07, 0.07, 0.012],
      material: createStandardMaterial({ color: 0x5b6470, roughness: 0.3 }),
      position: [widthM / 2 - 0.05, 0.07, depthM / 2 + 0.006],
    }),
    // Output tray and the rear paper feed
    createBoxMesh({
      size: [0.24, 0.004, 0.08],
      material: createStandardMaterial({ color: 0x1a1c1f }),
      position: [-0.02, 0.05, depthM / 2 + 0.04],
    }),
    createBoxMesh({
      size: [0.23, 0.11, 0.006],
      material: createStandardMaterial({ color: 0x1a1c1f }),
      position: [0, heightM + 0.05, -depthM / 2 + 0.03],
    }),
  )
  return printer
}
