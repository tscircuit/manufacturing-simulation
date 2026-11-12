import { Group } from "three"
import {
  createBoxMesh,
  createExtrudedMesh,
  createRectangleShape,
  createStandardMaterial,
} from "lib/scene/primitives"

export const FOAM_INSERT = {
  widthM: 0.11,
  depthM: 0.07,
  slabThicknessM: 0.008,
  frameHeightM: 0.022,
  pocketWidthM: 0.078,
  pocketDepthM: 0.046,
} as const

/** Total stack height of one insert. */
export const FOAM_INSERT_HEIGHT_M =
  FOAM_INSERT.slabThicknessM + FOAM_INSERT.frameHeightM

/**
 * Foam insert: a solid slab plus a frame with a pocket for the motor assembly.
 * The bottom insert has the slab underneath; the top insert is flipped so the
 * slab is on top. Origin is on its base.
 */
export function createFoamInsert(params: { isTopInsert: boolean }): Group {
  const insert = new Group()
  const foamMaterial = createStandardMaterial({ color: 0x3b3f45, roughness: 1 })
  const f = FOAM_INSERT
  const frame = createRectangleShape({ widthM: f.widthM, depthM: f.depthM })
  frame.holes.push(
    createRectangleShape({ widthM: f.pocketWidthM, depthM: f.pocketDepthM }),
  )
  const frameBaseYM = params.isTopInsert ? 0 : f.slabThicknessM
  const slabCenterYM = params.isTopInsert
    ? f.frameHeightM + f.slabThicknessM / 2
    : f.slabThicknessM / 2
  insert.add(
    createExtrudedMesh({
      shape: frame,
      depthM: f.frameHeightM,
      material: foamMaterial,
      baseYM: frameBaseYM,
    }),
    createBoxMesh({
      size: [f.widthM, f.slabThicknessM, f.depthM],
      material: foamMaterial,
      position: [0, slabCenterYM, 0],
    }),
  )
  return insert
}
