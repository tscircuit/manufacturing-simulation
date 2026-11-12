import { Group } from "three"
import {
  createCylinderMesh,
  createStandardMaterial,
} from "lib/scene/primitives"
import { BLACK_PLASTIC_MATERIAL } from "lib/scene/shared-materials"

/** 1 kg filament spool standing on its rim. Origin at its centre, axis along Z. */
export function createFilamentSpool(params: { filamentColor: number }): Group {
  const spool = new Group()
  spool.add(
    createCylinderMesh({
      radiusTopM: 0.1,
      radiusBottomM: 0.1,
      heightM: 0.065,
      material: createStandardMaterial({ color: params.filamentColor }),
      radialSegments: 28,
    }),
    createCylinderMesh({
      radiusTopM: 0.03,
      radiusBottomM: 0.03,
      heightM: 0.072,
      material: BLACK_PLASTIC_MATERIAL,
      radialSegments: 16,
    }),
  )
  spool.rotation.x = Math.PI / 2
  return spool
}
