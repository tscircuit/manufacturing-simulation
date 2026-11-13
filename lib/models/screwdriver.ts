import {
  createBoxMesh,
  createCylinderMesh,
  createStandardMaterial,
} from "lib/scene/primitives"
import {
  BLACK_PLASTIC_MATERIAL,
  STEEL_MATERIAL,
} from "lib/scene/shared-materials"
import { Group, MeshBasicMaterial } from "three"

/**
 * SKIL Twist 2.0 4V cordless screwdriver (Ace item 2033885): inline body with
 * a pivoting head (locked straight here), 1/4" hex bit, LED, forward/reverse
 * rocker and USB-C charging. Origin is the bit tip; +Y runs up the tool.
 */
export interface Screwdriver {
  group: Group
  /** Bit and chuck; spins about +Y while driving. */
  spinningPart: Group
}

export const SCREWDRIVER = {
  bitLengthM: 0.05,
  bodyRadiusM: 0.019,
  lengthM: 0.245,
} as const

/** Middle of the grip, well above the bit, where the operator holds it. */
export const SCREWDRIVER_GRIP_OFFSET_M = 0.16

const SKIL_RED = 0xc8202a

export function createScrewdriver(): Screwdriver {
  const group = new Group()
  const spinningPart = new Group()
  group.add(spinningPart)
  const body = createStandardMaterial({ color: 0x55595f, roughness: 0.45 })
  const grip = createStandardMaterial({ color: SKIL_RED, roughness: 0.75 })

  // 1/4" hex bit with a Phillips #1 tip, held in a magnetic chuck.
  spinningPart.add(
    createCylinderMesh({
      radiusTopM: 0.0032,
      radiusBottomM: 0.0032,
      heightM: 0.036,
      material: STEEL_MATERIAL,
      position: [0, 0.032, 0],
      radialSegments: 6,
    }),
    createCylinderMesh({
      radiusTopM: 0.0016,
      radiusBottomM: 0.0008,
      heightM: 0.014,
      material: STEEL_MATERIAL,
      position: [0, 0.007, 0],
      radialSegments: 8,
    }),
    createCylinderMesh({
      radiusTopM: 0.0075,
      radiusBottomM: 0.006,
      heightM: 0.014,
      material: BLACK_PLASTIC_MATERIAL,
      position: [0, 0.057, 0],
      radialSegments: 16,
    }),
  )
  group.add(
    // Pivot head with the LED ring at the front.
    createCylinderMesh({
      radiusTopM: 0.017,
      radiusBottomM: 0.012,
      heightM: 0.045,
      material: body,
      position: [0, 0.0865, 0],
      radialSegments: 20,
    }),
    createCylinderMesh({
      radiusTopM: 0.0115,
      radiusBottomM: 0.0115,
      heightM: 0.002,
      material: new MeshBasicMaterial({ color: 0xfff6d8 }),
      position: [0, 0.064, 0],
      radialSegments: 20,
    }),
    createCylinderMesh({
      radiusTopM: 0.0185,
      radiusBottomM: 0.0185,
      heightM: 0.008,
      material: BLACK_PLASTIC_MATERIAL,
      position: [0, 0.113, 0],
      radialSegments: 20,
    }),
    // Main body with the red overmolded grip.
    createCylinderMesh({
      radiusTopM: 0.0195,
      radiusBottomM: 0.0185,
      heightM: 0.13,
      material: body,
      position: [0, 0.182, 0],
      radialSegments: 20,
    }),
    createCylinderMesh({
      radiusTopM: 0.0205,
      radiusBottomM: 0.0198,
      heightM: 0.075,
      material: grip,
      position: [0, 0.172, 0],
      radialSegments: 20,
    }),
    createBoxMesh({
      size: [0.012, 0.024, 0.006],
      material: BLACK_PLASTIC_MATERIAL,
      position: [0, 0.136, 0.019],
    }),
    // End cap with the USB-C port.
    createCylinderMesh({
      radiusTopM: 0.016,
      radiusBottomM: 0.0195,
      heightM: 0.008,
      material: BLACK_PLASTIC_MATERIAL,
      position: [0, 0.251, 0],
      radialSegments: 20,
    }),
  )
  return { group, spinningPart }
}
