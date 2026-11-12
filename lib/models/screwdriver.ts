import { Group } from "three"
import {
  createBoxMesh,
  createCylinderMesh,
  createStandardMaterial,
} from "lib/scene/primitives"
import {
  BLACK_PLASTIC_MATERIAL,
  STEEL_MATERIAL,
} from "lib/scene/shared-materials"

/** Origin is the bit tip; +Y points toward the handle. */
export interface Screwdriver {
  group: Group
  /** Spins about +Y while driving a screw. */
  spinningPart: Group
}

/** Distance from the tip to the middle of the grip. */
export const SCREWDRIVER_GRIP_OFFSET_M = 0.15

const GRIP_RIB_COUNT = 6

export function createScrewdriver(): Screwdriver {
  const group = new Group()
  const spinningPart = new Group()
  group.add(spinningPart)
  spinningPart.add(
    createCylinderMesh({
      radiusTopM: 0.0016,
      radiusBottomM: 0.0012,
      heightM: 0.1,
      material: STEEL_MATERIAL,
      position: [0, 0.05, 0],
      radialSegments: 10,
    }),
    createCylinderMesh({
      radiusTopM: 0.008,
      radiusBottomM: 0.005,
      heightM: 0.012,
      material: BLACK_PLASTIC_MATERIAL,
      position: [0, 0.106, 0],
      radialSegments: 14,
    }),
    createCylinderMesh({
      radiusTopM: 0.0135,
      radiusBottomM: 0.012,
      heightM: 0.085,
      material: createStandardMaterial({ color: 0xf2b01e, roughness: 0.55 }),
      position: [0, 0.1545, 0],
      radialSegments: 14,
    }),
    createCylinderMesh({
      radiusTopM: 0.011,
      radiusBottomM: 0.0135,
      heightM: 0.006,
      material: BLACK_PLASTIC_MATERIAL,
      position: [0, 0.2, 0],
      radialSegments: 14,
    }),
  )
  for (let rib = 0; rib < GRIP_RIB_COUNT; rib++) {
    const angleRadians = (rib * Math.PI * 2) / GRIP_RIB_COUNT
    const ribMesh = createBoxMesh({
      size: [0.004, 0.06, 0.003],
      material: BLACK_PLASTIC_MATERIAL,
      position: [
        Math.cos(angleRadians) * 0.0132,
        0.155,
        Math.sin(angleRadians) * 0.0132,
      ],
    })
    ribMesh.rotation.y = -angleRadians + Math.PI / 2
    spinningPart.add(ribMesh)
  }
  return { group, spinningPart }
}
