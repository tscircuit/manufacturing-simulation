import { ExtrudeGeometry, Group, type Material, Mesh, Shape } from "three"
import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"

/**
 * Akro-Mils 30210 AkroBin, 5-3/8" x 4-1/8" x 3", black. Origin on the floor
 * of the bin, front (scoop) toward +Z.
 */
export const PARTS_BIN = {
  widthM: 0.105,
  depthM: 0.137,
  backHeightM: 0.076,
  frontHeightM: 0.035,
  wallThicknessM: 0.0025,
} as const

function createSideWall(params: { x: number; material: Material }): Mesh {
  const { depthM, backHeightM, frontHeightM, wallThicknessM } = PARTS_BIN
  // Profile drawn as (-z, y) so that rotating the extrusion a quarter turn about Y
  // puts it in the wall's plane, extruded along X.
  const profile = new Shape()
  profile.moveTo(depthM / 2, 0)
  profile.lineTo(-depthM / 2, 0)
  profile.lineTo(-depthM / 2, frontHeightM)
  profile.lineTo(-depthM / 4, backHeightM * 0.7)
  profile.lineTo(depthM / 2, backHeightM)
  profile.closePath()
  const geometry = new ExtrudeGeometry(profile, {
    depth: wallThicknessM,
    bevelEnabled: false,
  })
  geometry.rotateY(Math.PI / 2)
  const wall = new Mesh(geometry, params.material)
  wall.position.x = params.x - wallThicknessM / 2
  wall.castShadow = true
  wall.receiveShadow = true
  return wall
}

export function createPartsBin(params: { labelColor: number }): Group {
  const bin = new Group()
  const material = createStandardMaterial({
    color: 0x1d1f22,
    roughness: 0.6,
  })
  const { widthM, depthM, backHeightM, frontHeightM, wallThicknessM } =
    PARTS_BIN
  bin.add(
    createBoxMesh({
      size: [widthM, wallThicknessM, depthM],
      material,
      position: [0, wallThicknessM / 2, 0],
    }),
    createBoxMesh({
      size: [widthM, backHeightM, wallThicknessM],
      material,
      position: [0, backHeightM / 2, -depthM / 2],
    }),
    createBoxMesh({
      size: [widthM, frontHeightM, wallThicknessM],
      material,
      position: [0, frontHeightM / 2, depthM / 2],
    }),
    createBoxMesh({
      size: [widthM * 0.6, 0.016, 0.0008],
      material: createStandardMaterial({ color: params.labelColor }),
      position: [
        0,
        frontHeightM * 0.5,
        depthM / 2 + wallThicknessM / 2 + 0.0004,
      ],
    }),
  )
  for (const sideX of [
    -widthM / 2 + wallThicknessM / 2,
    widthM / 2 - wallThicknessM / 2,
  ]) {
    bin.add(createSideWall({ x: sideX, material }))
  }
  return bin
}
