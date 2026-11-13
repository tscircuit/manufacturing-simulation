import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { METERS_PER_INCH } from "lib/units"
import { SCREW_LYING_QUATERNION } from "lib/world/bench-spots"
import { Group, Object3D } from "three"

/**
 * 2" x 3" pink anti-static reclosable bag (4 mil) for the four long M3
 * screws, so they can't scratch the board in the outer bag. The screws lie in
 * the bottom half; the top half (with the zip) folds over them, leaving a
 * 2" x 1.5" packet about 5 mm thick.
 */
export const SCREW_POUCH = {
  widthM: 2 * METERS_PER_INCH,
  lengthM: 3 * METERS_PER_INCH,
  foldedLengthM: 1.5 * METERS_PER_INCH,
  /** Two film layers with the screw heads between them. */
  thicknessM: 0.0035,
  filmM: 0.0001,
  sealWidthM: 0.0025,
  zipFromTopM: 0.008,
} as const

/**
 * Lying flat, origin at the centre of the folded packet. The bottom half runs
 * +Z to the fold at -Z; the top half (the open end, with the zip) hinges at
 * the fold and lies on top once folded.
 */
export interface ScrewPouch {
  group: Group
  /** Hinged at the fold: rotation.x 0 is open flat, Math.PI is folded over. */
  topFlap: Group
  /** A spot for each screw, side by side in the bottom half. */
  screwSpots: Object3D[]
}

const FILM_MATERIAL = createStandardMaterial({
  color: 0xf3a1c0,
  roughness: 0.35,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
})
const SEAL_MATERIAL = createStandardMaterial({
  color: 0xe789ad,
  roughness: 0.5,
  transparent: true,
  opacity: 0.75,
})
const ZIP_MATERIAL = createStandardMaterial({
  color: 0xd9779c,
  roughness: 0.5,
})

/** One half of the bag: a front and back film, sealed at the sides. */
function createHalf(params: {
  lengthM: number
  withSealAt: "bottom" | "none"
}): Group {
  const p = SCREW_POUCH
  const half = new Group()
  for (const y of [p.filmM / 2, p.thicknessM - p.filmM / 2])
    half.add(
      createBoxMesh({
        size: [p.widthM, p.filmM, params.lengthM],
        material: FILM_MATERIAL,
        position: [0, y, 0],
      }),
    )
  for (const side of [-1, 1])
    half.add(
      createBoxMesh({
        size: [p.sealWidthM, p.thicknessM * 0.6, params.lengthM],
        material: SEAL_MATERIAL,
        position: [
          side * (p.widthM / 2 - p.sealWidthM / 2),
          p.thicknessM * 0.3,
          0,
        ],
      }),
    )
  if (params.withSealAt === "bottom")
    half.add(
      createBoxMesh({
        size: [p.widthM, p.thicknessM * 0.6, p.sealWidthM],
        material: SEAL_MATERIAL,
        position: [
          0,
          p.thicknessM * 0.3,
          params.lengthM / 2 - p.sealWidthM / 2,
        ],
      }),
    )
  return half
}

export function createScrewPouch(): ScrewPouch {
  const p = SCREW_POUCH
  const group = new Group()
  const halfLengthM = p.foldedLengthM
  group.add(createHalf({ lengthM: halfLengthM, withSealAt: "bottom" }))

  // The top half hinges at the fold line (-Z edge of the bottom half).
  const topFlap = new Group()
  // Hinge at the top film, so folded over the flap lies on top of the bottom half.
  topFlap.position.set(0, p.thicknessM, -halfLengthM / 2)
  const flapBody = createHalf({ lengthM: halfLengthM, withSealAt: "none" })
  flapBody.position.set(0, -p.thicknessM, -halfLengthM / 2)
  topFlap.add(flapBody)
  // Zip track near the open end, two ridges.
  for (const offsetM of [0, 0.0018])
    topFlap.add(
      createBoxMesh({
        size: [p.widthM - 2 * p.sealWidthM, 0.0012, 0.0009],
        material: ZIP_MATERIAL,
        position: [
          0,
          -p.thicknessM / 2,
          -halfLengthM + p.zipFromTopM + offsetM,
        ],
      }),
    )
  group.add(topFlap)

  const screwSpots = [0, 1, 2, 3].map((index) => {
    const spot = new Object3D()
    spot.position.set((index - 1.5) * 0.0075, p.thicknessM / 2, 0.003)
    spot.quaternion.copy(SCREW_LYING_QUATERNION)
    group.add(spot)
    return spot
  })
  return { group, topFlap, screwSpots }
}
