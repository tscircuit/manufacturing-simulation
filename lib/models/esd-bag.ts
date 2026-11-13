import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { METERS_PER_INCH } from "lib/units"
import { Group, Matrix4, type Mesh, Object3D, Vector3 } from "three"

/**
 * 3" x 5" reclosable metallized static-shielding bag (about 3 mil), sized for
 * the bare unit's parts kit: board, spacer, four screws and the coiled motor
 * cable (no motor). The 3" opening is well under the 5" at which Amazon and
 * several US states require a printed suffocation warning. The bag is
 * see-through enough to show the parts, and the FNSKU label goes on the
 * outside so it scans without reading through the film.
 */
export const ESD_BAG = {
  widthM: 3 * METERS_PER_INCH,
  heightM: 5 * METERS_PER_INCH,
  filmThicknessM: 0.00008,
  /** Depth with the kit inside: its 10.4 mm board pile plus film and give. */
  filledDepthM: 0.016,
  zipFromTopM: 0.01,
} as const

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
  /** The printed ESD warning mark on the front film. */
  esdMark: Mesh
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
/** Flat heat seal down each side and across the bottom. */
const BAG_SEAL_WIDTH_M = 0.004
/** The flat lip above the zip. */
const BAG_LIP_M = 0.006
const ESD_MARK_MATERIAL = createStandardMaterial({
  color: 0xf2c230,
  roughness: 0.6,
})

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
  // The printed ESD warning mark in the bottom corner of the front.
  const esdMark = createBoxMesh({
    size: [0.014, 0.012, 0.0004],
    material: ESD_MARK_MATERIAL,
    position: [b.widthM / 2 - 0.014, 0.014, 0.0005],
  })
  group.add(flatBody, filledBody, zip, esdMark)

  const contentsSpot = new Object3D()
  // The kit stands on edge facing the front: the board on its spacer at the
  // bottom, the cable and screw pouch above it.
  contentsSpot.position.set(0, 0.058, -0.0052)
  contentsSpot.rotation.x = Math.PI / 2
  const frontStickerSpot = new Object3D()
  // High on the front, so the board shows through below it.
  frontStickerSpot.position.set(0, b.heightM * 0.6, b.filledDepthM / 2 + 0.0004)
  // Sticker local +Y is its printed face: turn it to face +Z, long side vertical, top up.
  frontStickerSpot.rotation.set(Math.PI / 2, 0, 0)
  const backLabelSpot = new Object3D()
  backLabelSpot.position.set(0, b.heightM * 0.72, -b.filledDepthM / 2 - 0.0004)
  // Printed face out the back (-Z), long side across the bag.
  backLabelSpot.quaternion.setFromRotationMatrix(
    new Matrix4().makeBasis(
      new Vector3(0, 1, 0),
      new Vector3(0, 0, -1),
      new Vector3(-1, 0, 0),
    ),
  )
  const zipGrip = new Object3D()
  zipGrip.position.set(-b.widthM / 2 + 0.01, b.heightM - b.zipFromTopM, 0)
  group.add(contentsSpot, frontStickerSpot, backLabelSpot, zipGrip)
  return {
    group,
    flatBody,
    filledBody,
    zip,
    esdMark,
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
  // The mark is printed on the front film, which moves out as the bag fills.
  bag.esdMark.position.z = isFilled ? ESD_BAG.filledDepthM / 2 + 0.0004 : 0.0005
}
