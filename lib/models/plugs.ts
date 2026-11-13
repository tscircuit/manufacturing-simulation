import {
  createBoxMesh,
  createCylinderMesh,
  createStandardMaterial,
} from "lib/scene/primitives"
import {
  BLACK_PLASTIC_MATERIAL,
  STEEL_MATERIAL,
} from "lib/scene/shared-materials"
import { Group, Object3D } from "three"

/**
 * A cable plug. Origin is the mating face; the plug body runs along +Y and
 * the wire leaves from `wireAnchor`, also pointing +Y.
 */
export interface CablePlug {
  group: Group
  wireAnchor: Object3D
}

export function createUsbCPlug(params: { overmoldColor?: number }): CablePlug {
  const group = new Group()
  const overmold = params.overmoldColor
    ? createStandardMaterial({ color: params.overmoldColor, roughness: 0.5 })
    : BLACK_PLASTIC_MATERIAL
  group.add(
    createBoxMesh({
      size: [0.0084, 0.0065, 0.0026],
      material: STEEL_MATERIAL,
      position: [0, 0.00325, 0],
    }),
    createBoxMesh({
      size: [0.0125, 0.02, 0.0062],
      material: overmold,
      position: [0, 0.0165, 0],
    }),
    createCylinderMesh({
      radiusTopM: 0.0021,
      radiusBottomM: 0.0028,
      heightM: 0.008,
      material: overmold,
      position: [0, 0.0305, 0],
      radialSegments: 10,
    }),
  )
  const wireAnchor = new Object3D()
  wireAnchor.position.y = 0.034
  group.add(wireAnchor)
  return { group, wireAnchor }
}

const JST_PH_PITCH_M = 0.002
const JST_PLUG_MATERIAL = createStandardMaterial({
  color: 0xf2f2ee,
  roughness: 0.5,
})
const JST_WIRE_COLORS = [
  0xd23b2e, 0x2b5fd6, 0x2f9d4a, 0x1a1a1a, 0xe2c23a, 0xffffff,
]

/**
 * JST PH 2.0 mm housing (PHR-n): (n - 1) × 2 mm + 3.9 mm wide, 6 mm long, 4.5 mm thick.
 * The motor end is 6-pin; the controller's J1 takes the 4-pin PHR-4.
 */
export function createJstPlug(params: { pinCount: number }): CablePlug {
  const group = new Group()
  const widthM = (params.pinCount - 1) * JST_PH_PITCH_M + 0.0039
  group.add(
    createBoxMesh({
      size: [widthM, 0.006, 0.0045],
      material: JST_PLUG_MATERIAL,
      position: [0, 0.003, 0],
    }),
  )
  // Coloured wire stubs at the back of the housing, one per used contact.
  const wireCount = Math.min(4, params.pinCount)
  for (let index = 0; index < wireCount; index++) {
    group.add(
      createCylinderMesh({
        radiusTopM: 0.0005,
        radiusBottomM: 0.0005,
        heightM: 0.0025,
        material: createStandardMaterial({
          color: JST_WIRE_COLORS[index],
          roughness: 0.6,
        }),
        position: [(index - (wireCount - 1) / 2) * JST_PH_PITCH_M, 0.00725, 0],
        radialSegments: 6,
      }),
    )
  }
  const wireAnchor = new Object3D()
  wireAnchor.position.y = 0.0085
  group.add(wireAnchor)
  return { group, wireAnchor }
}
