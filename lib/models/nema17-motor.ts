import { Group } from "three"
import {
  createBoxMesh,
  createCylinderMesh,
  createExtrudedMesh,
  createOctagonShape,
  createStandardMaterial,
} from "lib/scene/primitives"
import {
  BLACK_PLASTIC_MATERIAL,
  DARK_METAL_MATERIAL,
  STEEL_MATERIAL,
} from "lib/scene/shared-materials"

export const NEMA17 = {
  faceSizeM: 0.0423,
  bodyLengthM: 0.04,
  screwPitchM: 0.031,
  /** Height of the back face above the mounting face. */
  backfaceHeightM: 0.04,
} as const

/** Which corner of the bolt pattern a screw sits in (±1 on X and Z). */
export interface BoltHoleCorner {
  xSign: number
  zSign: number
}

export interface BackfaceScrew {
  group: Group
  corner: BoltHoleCorner
}

/** Origin is the centre of the mounting face; +Y points toward the back face. */
export interface Nema17Motor {
  group: Group
  backfaceScrews: BackfaceScrew[]
}

export const BOLT_HOLE_CORNERS: BoltHoleCorner[] = [
  { xSign: -1, zSign: -1 },
  { xSign: 1, zSign: -1 },
  { xSign: 1, zSign: 1 },
  { xSign: -1, zSign: 1 },
]

/** M3 socket-head screw. Origin is the underside of the head; the shank points down. */
export function createM3Screw(): Group {
  const screw = new Group()
  screw.add(
    createCylinderMesh({
      radiusTopM: 0.00275,
      radiusBottomM: 0.00275,
      heightM: 0.003,
      material: BLACK_PLASTIC_MATERIAL,
      position: [0, 0.0015, 0],
      radialSegments: 14,
    }),
    createCylinderMesh({
      radiusTopM: 0.0015,
      radiusBottomM: 0.0015,
      heightM: 0.016,
      material: STEEL_MATERIAL,
      position: [0, -0.008, 0],
      radialSegments: 10,
    }),
    createCylinderMesh({
      radiusTopM: 0.0012,
      radiusBottomM: 0.0012,
      heightM: 0.0004,
      material: STEEL_MATERIAL,
      position: [0, 0.0031, 0],
      radialSegments: 6,
    }),
  )
  return screw
}

export function createNema17Motor(): Nema17Motor {
  const group = new Group()
  const endCapMaterial = createStandardMaterial({
    color: 0xc7ccd1,
    metalness: 0.7,
    roughness: 0.4,
  })
  group.add(
    createExtrudedMesh({
      shape: createOctagonShape({
        sizeM: NEMA17.faceSizeM,
        cornerClipM: 0.004,
      }),
      depthM: 0.009,
      material: endCapMaterial,
    }),
    createExtrudedMesh({
      shape: createOctagonShape({ sizeM: 0.0415, cornerClipM: 0.006 }),
      depthM: 0.022,
      material: BLACK_PLASTIC_MATERIAL,
      baseYM: 0.009,
    }),
    createExtrudedMesh({
      shape: createOctagonShape({
        sizeM: NEMA17.faceSizeM,
        cornerClipM: 0.004,
      }),
      depthM: 0.009,
      material: DARK_METAL_MATERIAL,
      baseYM: 0.031,
    }),
    createCylinderMesh({
      radiusTopM: 0.011,
      radiusBottomM: 0.011,
      heightM: 0.002,
      material: endCapMaterial,
      position: [0, -0.001, 0],
    }),
    createCylinderMesh({
      radiusTopM: 0.0025,
      radiusBottomM: 0.0025,
      heightM: 0.024,
      material: STEEL_MATERIAL,
      position: [0, -0.012, 0],
      radialSegments: 14,
    }),
    createBoxMesh({
      size: [0.016, 0.006, 0.005],
      material: createStandardMaterial({ color: 0xf2f2ee }),
      position: [0, 0.035, -0.0235],
    }),
  )
  const halfPitchM = NEMA17.screwPitchM / 2
  const backfaceScrews = BOLT_HOLE_CORNERS.map((corner) => {
    const screw = createM3Screw()
    screw.position.set(
      corner.xSign * halfPitchM,
      NEMA17.backfaceHeightM,
      corner.zSign * halfPitchM,
    )
    group.add(screw)
    return { group: screw, corner }
  })
  return { group, backfaceScrews }
}
