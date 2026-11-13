import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { METERS_PER_INCH } from "lib/units"
import { Group, Mesh, PlaneGeometry } from "three"

/**
 * 2" x 4" tscircuit product label. Origin at the centre of its adhesive side;
 * the 4" side runs along Z and the top of the printing faces -Z.
 */
export const STICKER = {
  widthM: 2 * METERS_PER_INCH,
  lengthM: 4 * METERS_PER_INCH,
  thicknessM: 0.0003,
} as const

/** Which printed design a sticker carries; the viewer picks the texture by this. */
export type StickerArtwork = "kit_label" | "bag_label" | "fnsku" | "fba_box"

/**
 * The printed face is a separate mesh tagged `isStickerFace` (and its
 * `stickerArtwork`) so the viewer can give it the right label artwork.
 * Defaults to the 2" x 4" kit label.
 */
export function createSticker(
  params: { widthM?: number; lengthM?: number; artwork?: StickerArtwork } = {},
): Group {
  const widthM = params.widthM ?? STICKER.widthM
  const lengthM = params.lengthM ?? STICKER.lengthM
  const sticker = new Group()
  sticker.add(
    createBoxMesh({
      size: [widthM, STICKER.thicknessM, lengthM],
      material: createStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
      position: [0, STICKER.thicknessM / 2, 0],
    }),
  )
  const face = new Mesh(
    new PlaneGeometry(widthM, lengthM),
    createStandardMaterial({ color: 0xf4f6fa, roughness: 0.35 }),
  )
  face.rotation.x = -Math.PI / 2
  face.position.y = STICKER.thicknessM + 0.00005
  face.userData.isStickerFace = true
  face.userData.stickerArtwork = params.artwork ?? "kit_label"
  sticker.add(face)
  return sticker
}
