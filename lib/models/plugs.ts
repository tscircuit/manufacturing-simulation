import { Group, Object3D } from "three"
import {
  createBoxMesh,
  createCylinderMesh,
  createStandardMaterial,
} from "lib/scene/primitives"
import {
  BLACK_PLASTIC_MATERIAL,
  STEEL_MATERIAL,
} from "lib/scene/shared-materials"

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

export function createJstPlug(): CablePlug {
  const group = new Group()
  group.add(
    createBoxMesh({
      size: [0.012, 0.0075, 0.0045],
      material: createStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 }),
      position: [0, 0.00375, 0],
    }),
  )
  const wireAnchor = new Object3D()
  wireAnchor.position.y = 0.0085
  group.add(wireAnchor)
  return { group, wireAnchor }
}
