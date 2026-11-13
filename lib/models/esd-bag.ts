import { createSticker } from "lib/models/sticker"
import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { METERS_PER_INCH } from "lib/units"
import { Group, Matrix4, type Mesh, Object3D, Vector3 } from "three"

/**
 * Ellbest 3.15" x 4.72" (80 x 120 mm) resealable ESD shielding bag
 * (Amazon B07QFZBT9Z, 200 per pack): translucent grey metallized PET with a
 * zip near the top. It holds the bare unit: board on its spacer, the coiled
 * motor cable and the screw pouch, side by side. The 80 mm opening is well
 * under the 5" at which Amazon requires a suffocation warning. A yellow ESD
 * caution sticker is on the back, and the FNSKU label goes on the outside so
 * it scans without reading through the film.
 */
export const ESD_BAG = {
  widthM: 0.08,
  heightM: 0.12,
  filmThicknessM: 0.00008,
  /** Depth with the parts inside: the 12 mm cable-and-pouch pile plus film and give. */
  filledDepthM: 0.016,
  /** The zip on these bags sits about 15 mm below the top edge. */
  zipFromTopM: 0.015,
  /** Heat seal down each side and across the bottom. */
  sealWidthM: 0.003,
} as const

/** The yellow ESD caution sticker on the back: 2" x 1". */
export const ESD_CAUTION_STICKER = {
  widthM: 1 * METERS_PER_INCH,
  lengthM: 2 * METERS_PER_INCH,
} as const

/** The original tscircuit 2" x 4" label, upright on the front between the bottom seal and the zip. */
export const FRONT_LABEL_CENTER_FROM_BOTTOM_M =
  (ESD_BAG.sealWidthM + ESD_BAG.heightM - ESD_BAG.zipFromTopM - 0.002) / 2

/**
 * Origin at the middle of the bag's bottom edge. Standing up, the opening is
 * at +Y, the front (where the product sticker goes) faces +Z and the back
 * (FNSKU label) faces -Z.
 */
export interface EsdBag {
  group: Group
  /** The bag lying flat, before anything is in it. */
  flatBody: Mesh
  /** The bag puffed out around the unit. */
  filledBody: Mesh
  zip: Group
  /** The yellow ESD caution sticker on the back film. */
  cautionSticker: Group
  /** Where the parts kit sits inside, its stack facing the front. */
  contentsSpot: Object3D
  /** Front sticker and back FNSKU label poses, with the label's printed face out. */
  frontStickerSpot: Object3D
  backLabelSpot: Object3D
  /** Where the fingers pinch to slide the zip closed. */
  zipGrip: Object3D
}

const BAG_FILM_MATERIAL = createStandardMaterial({
  color: 0x8f9499,
  metalness: 0.55,
  roughness: 0.35,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
})
const ZIP_MATERIAL = createStandardMaterial({ color: 0x6b7076, roughness: 0.6 })
const BAG_SEAL_MATERIAL = createStandardMaterial({
  color: 0x7c8187,
  metalness: 0.5,
  roughness: 0.4,
  transparent: true,
  opacity: 0.75,
})
const BAG_SEAL_WIDTH_M = ESD_BAG.sealWidthM
/** The flat lip above the zip. */
const BAG_LIP_M = 0.01

export function createEsdBag(): EsdBag {
  const b = ESD_BAG
  const group = new Group()
  const flatBody = createBoxMesh({
    size: [b.widthM, b.heightM, 0.0006],
    material: BAG_FILM_MATERIAL,
    position: [0, b.heightM / 2, 0],
  })
  // Filled, the film pillows out between the flat heat seals at the sides and bottom.
  const filledBody = createBoxMesh({
    size: [
      b.widthM - 2 * BAG_SEAL_WIDTH_M,
      b.heightM - BAG_SEAL_WIDTH_M - BAG_LIP_M,
      b.filledDepthM,
    ],
    material: BAG_FILM_MATERIAL,
    position: [
      0,
      BAG_SEAL_WIDTH_M + (b.heightM - BAG_SEAL_WIDTH_M - BAG_LIP_M) / 2,
      0,
    ],
  })
  filledBody.visible = false
  // Heat seals down both sides and across the bottom, and the lip above the zip.
  for (const side of [-1, 1])
    group.add(
      createBoxMesh({
        size: [BAG_SEAL_WIDTH_M, b.heightM, 0.0008],
        material: BAG_SEAL_MATERIAL,
        position: [
          side * (b.widthM / 2 - BAG_SEAL_WIDTH_M / 2),
          b.heightM / 2,
          0,
        ],
      }),
    )
  group.add(
    createBoxMesh({
      size: [b.widthM, BAG_SEAL_WIDTH_M, 0.0008],
      material: BAG_SEAL_MATERIAL,
      position: [0, BAG_SEAL_WIDTH_M / 2, 0],
    }),
    createBoxMesh({
      size: [b.widthM, BAG_LIP_M, 0.0008],
      material: BAG_SEAL_MATERIAL,
      position: [0, b.heightM - BAG_LIP_M / 2, 0],
    }),
  )
  // Zip track: two ridges just under the lip.
  const zip = new Group()
  for (const offsetM of [0, 0.0022])
    zip.add(
      createBoxMesh({
        size: [b.widthM - 2 * BAG_SEAL_WIDTH_M, 0.0012, 0.0035],
        material: ZIP_MATERIAL,
        position: [0, b.heightM - b.zipFromTopM - offsetM, 0],
      }),
    )
  group.add(flatBody, filledBody, zip)

  const contentsSpot = new Object3D()
  // The parts stand on edge facing the front: the board on its spacer at the
  // bottom, the cable and screw pouch above it, clear of the zip.
  contentsSpot.position.set(0, 0.053, -0.0052)
  contentsSpot.rotation.x = Math.PI / 2
  const frontStickerSpot = new Object3D()
  // The 4" label fills the front from the bottom seal to just under the zip.
  frontStickerSpot.position.set(
    0,
    FRONT_LABEL_CENTER_FROM_BOTTOM_M,
    b.filledDepthM / 2 + 0.0004,
  )
  // Sticker local +Y is its printed face: turn it to face +Z, long side vertical, top up.
  frontStickerSpot.rotation.set(Math.PI / 2, 0, 0)
  const backLabelSpot = new Object3D()
  backLabelSpot.position.set(0, 0.08, -b.filledDepthM / 2 - 0.0004)
  // Printed face out the back (-Z), long side across the bag.
  const backBasis = new Matrix4().makeBasis(
    new Vector3(0, 1, 0),
    new Vector3(0, 0, -1),
    new Vector3(-1, 0, 0),
  )
  backLabelSpot.quaternion.setFromRotationMatrix(backBasis)
  // The caution sticker comes on the bag, low on the back under the FNSKU label.
  const cautionSticker = createSticker({
    widthM: ESD_CAUTION_STICKER.widthM,
    lengthM: ESD_CAUTION_STICKER.lengthM,
    artwork: "esd_caution",
  })
  cautionSticker.position.set(0, 0.04, -0.0005)
  cautionSticker.quaternion.setFromRotationMatrix(backBasis)
  group.add(cautionSticker)
  const zipGrip = new Object3D()
  zipGrip.position.set(-b.widthM / 2 + 0.01, b.heightM - b.zipFromTopM, 0)
  group.add(contentsSpot, frontStickerSpot, backLabelSpot, zipGrip)
  return {
    group,
    flatBody,
    filledBody,
    zip,
    cautionSticker,
    contentsSpot,
    frontStickerSpot,
    backLabelSpot,
    zipGrip,
  }
}

/** Puff the bag out around its contents (or lay it flat again). */
export function setEsdBagFilled(params: {
  bag: EsdBag
  isFilled: boolean
}): void {
  const { bag, isFilled } = params
  bag.flatBody.visible = !isFilled
  bag.filledBody.visible = isFilled
  // The caution sticker is on the back film, which moves out as the bag fills.
  bag.cautionSticker.position.z = isFilled
    ? -ESD_BAG.filledDepthM / 2 - 0.0004
    : -0.0005
}
