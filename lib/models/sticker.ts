import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { METERS_PER_INCH } from "lib/units"
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three"

/**
 * 2" x 4" tscircuit product label. Origin at the centre of its adhesive side;
 * the 4" side runs along Z and the top of the printing faces -Z.
 */
export const STICKER = {
  widthM: 2 * METERS_PER_INCH,
  lengthM: 4 * METERS_PER_INCH,
  thicknessM: 0.0003,
} as const

export type StickerKind = "tscircuit" | "fnsku"

/** Landscape 2⅝" × 1" unit label for the US Letter 30-up sheet. */
export const FNSKU_STICKER = {
  widthM: 2.625 * METERS_PER_INCH,
  lengthM: METERS_PER_INCH,
  thicknessM: STICKER.thicknessM,
} as const

/**
 * The viewer textures the printed face using its sticker kind.
 */
export function createSticker(kind: StickerKind = "tscircuit"): Group {
  const { widthM, lengthM, thicknessM } =
    kind === "fnsku" ? FNSKU_STICKER : STICKER
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
    kind === "fnsku"
      ? new MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
      : createStandardMaterial({ color: 0xf4f6fa, roughness: 0.35 }),
  )
  face.rotation.x = -Math.PI / 2
  face.position.y = thicknessM + 0.00005
  face.userData.stickerKind = kind
  sticker.add(face)
  return sticker
}
