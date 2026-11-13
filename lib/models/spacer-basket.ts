import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { Group, Object3D, Vector3 } from "three"

/** Shallow open basket for printed spacers. Origin on its floor. */
export const SPACER_BASKET = { wallThicknessM: 0.003 } as const

export interface SpacerContainerSize {
  widthM: number
  depthM: number
  heightM: number
  color: number
}

/** The basket at the assembly bench, within reach of the jig. */
export const ASSEMBLY_SPACER_BASKET: SpacerContainerSize = {
  widthM: 0.16,
  depthM: 0.11,
  heightM: 0.085,
  color: 0x3a4048,
}
/** Tub that collects spacers from the printer plates and carries them to the basket. */
export const SPACER_TUB: SpacerContainerSize = {
  widthM: 0.3,
  depthM: 0.2,
  heightM: 0.1,
  color: 0xc9ccd0,
}

const PILE_PITCH_M = 0.046
const PILE_LAYER_M = 0.0042

/** Spacers a container holds when filled to its rim. */
export function getSpacerCapacity(container: SpacerContainerSize): number {
  const perLayer =
    Math.floor(container.widthM / PILE_PITCH_M) *
    Math.floor(container.depthM / PILE_PITCH_M)
  return perLayer * Math.floor((container.heightM - 0.006) / PILE_LAYER_M)
}

/** Where the `index`-th spacer lies in a container, in container coordinates; later spacers sit on top. */
export function getSpacerPilePosition(params: {
  index: number
  container: SpacerContainerSize
}): Vector3 {
  const columns = Math.floor(params.container.widthM / PILE_PITCH_M)
  const rows = Math.floor(params.container.depthM / PILE_PITCH_M)
  const perLayer = columns * rows
  const layer = Math.floor(params.index / perLayer)
  const inLayer = params.index % perLayer
  const column = inLayer % columns
  const row = Math.floor(inLayer / columns)
  // Alternate layers are offset a little so the pile looks poured, not stacked.
  const jitterM = layer % 2 === 0 ? 0 : 0.008
  return new Vector3(
    (column - (columns - 1) / 2) * PILE_PITCH_M + jitterM,
    0.004 + layer * PILE_LAYER_M,
    (row - (rows - 1) / 2) * PILE_PITCH_M - jitterM,
  )
}

export function createSpacerBasket(params: {
  widthM: number
  depthM: number
  heightM: number
  color: number
}): Group {
  const basket = new Group()
  const material = createStandardMaterial({
    color: params.color,
    roughness: 0.8,
  })
  const { widthM, depthM, heightM } = params
  const { wallThicknessM } = SPACER_BASKET
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
  // Grip points on each end, for carrying with both hands.
  for (const [name, sideX] of [
    ["left_grip", -1],
    ["right_grip", 1],
  ] as const) {
    const grip = new Object3D()
    grip.name = name
    grip.position.set((sideX * params.widthM) / 2, params.heightM, 0)
    basket.add(grip)
  }
  return basket
}
