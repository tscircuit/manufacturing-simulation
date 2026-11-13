import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { METERS_PER_INCH } from "lib/units"
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three"

/** 4" x 6" thermal stock, with the adhesive side at local Y = 0. */
export const CARTON_LABEL = {
  widthM: 4 * METERS_PER_INCH,
  lengthM: 6 * METERS_PER_INCH,
  thicknessM: 0.0003,
} as const

export function createCartonLabel() {
  const group = new Group()
  const { widthM, lengthM, thicknessM } = CARTON_LABEL
  group.add(
    createBoxMesh({
      size: [widthM, thicknessM, lengthM],
      material: createStandardMaterial({ color: 0xffffff }),
      position: [0, thicknessM / 2, 0],
    }),
  )
  const face = new Mesh(
    new PlaneGeometry(widthM, lengthM),
    new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  )
  face.rotation.x = -Math.PI / 2
  face.position.y = thicknessM + 0.00005
  group.add(face)
  return { group, face }
}
