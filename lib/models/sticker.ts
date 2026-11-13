import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { METERS_PER_INCH } from "lib/units"
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three"

/**
 * 2" x 3" NEMA17 label with tscircuit branding and a sample FNSKU.
 * The adhesive face is at local Y = 0 and the artwork top faces -Z.
 */
export const STICKER = {
  widthM: 2 * METERS_PER_INCH,
  lengthM: 3 * METERS_PER_INCH,
  thicknessM: 0.0003,
} as const

export function createSticker(): Group {
  const { widthM, lengthM, thicknessM } = STICKER
  const sticker = new Group()
  sticker.add(
    createBoxMesh({
      size: [widthM, thicknessM, lengthM],
      material: createStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
      position: [0, thicknessM / 2, 0],
    }),
  )
  const face = new Mesh(
    new PlaneGeometry(widthM, lengthM),
    new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  )
  face.rotation.x = -Math.PI / 2
  face.position.y = thicknessM + 0.00005
  face.userData.isStickerFace = true
  sticker.add(face)
  return sticker
}
