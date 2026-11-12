import { Group } from "three"
import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"

/** Shallow open basket for printed spacers. Origin on its floor. */
export const SPACER_BASKET = {
  widthM: 0.22,
  depthM: 0.16,
  heightM: 0.06,
  wallThicknessM: 0.003,
} as const

export function createSpacerBasket(): Group {
  const basket = new Group()
  const material = createStandardMaterial({ color: 0x3a4048, roughness: 0.8 })
  const { widthM, depthM, heightM, wallThicknessM } = SPACER_BASKET
  basket.add(
    createBoxMesh({
      size: [widthM, wallThicknessM, depthM],
      material,
      position: [0, wallThicknessM / 2, 0],
    }),
    createBoxMesh({
      size: [widthM, heightM, wallThicknessM],
      material,
      position: [0, heightM / 2, -depthM / 2],
    }),
    createBoxMesh({
      size: [widthM, heightM, wallThicknessM],
      material,
      position: [0, heightM / 2, depthM / 2],
    }),
    createBoxMesh({
      size: [wallThicknessM, heightM, depthM],
      material,
      position: [-widthM / 2, heightM / 2, 0],
    }),
    createBoxMesh({
      size: [wallThicknessM, heightM, depthM],
      material,
      position: [widthM / 2, heightM / 2, 0],
    }),
  )
  return basket
}
