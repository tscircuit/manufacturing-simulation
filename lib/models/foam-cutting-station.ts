import {
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineLoop,
  Path,
  Vector2,
  Vector3,
} from "three"
import {
  FOAM_INSERT,
  FOAM_INSERT_HEIGHT_M,
  FOAM_MATERIAL,
} from "lib/models/foam-insert"
import {
  createBoxMesh,
  createCylinderMesh,
  createExtrudedMesh,
  createRectangleShape,
  createStandardMaterial,
} from "lib/scene/primitives"

export const FOAM_SHEET = { lengthM: 1.2, widthM: 0.6 }
const MAT_THICKNESS_M = 0.012
const SHEET_BASE_Y_M = MAT_THICKNESS_M + 2 * FOAM_INSERT_HEIGHT_M
export const FOAM_SHEET_SURFACE_Y_M = SHEET_BASE_Y_M + FOAM_INSERT_HEIGHT_M
export const CUTTER_HOME = new Vector3(0.46, 0.06, -0.26)
const CUT_GAP_M = 0.002
const BEAM_OFFSET_Z_M = -0.055

function rectangle(center: Vector3, widthM: number, depthM: number): Vector3[] {
  const x = widthM / 2
  const z = depthM / 2
  return [
    new Vector3(-x, 0, z),
    new Vector3(x, 0, z),
    new Vector3(x, 0, -z),
    new Vector3(-x, 0, -z),
  ].map((corner) => corner.add(center))
}

/** Bench-local geometry, with the origin on the tabletop. */
export function createFoamCuttingStation() {
  const group = new Group()
  group.name = "foam-cutting-station"
  const frameMaterial = createStandardMaterial({ color: 0x276365 })
  const railMaterial = createStandardMaterial({
    color: 0x9da9ad,
    metalness: 0.5,
  })
  const guideMaterial = new LineBasicMaterial({ color: 0xe6b66d })
  group.add(
    createBoxMesh({
      size: [1.37, MAT_THICKNESS_M, 0.69],
      position: [0, MAT_THICKNESS_M / 2, 0],
      material: frameMaterial,
    }),
  )
  for (const x of [-0.65, 0.65]) {
    group.add(
      createBoxMesh({
        size: [0.03, 0.025, 0.68],
        position: [x, MAT_THICKNESS_M + 0.0125, 0],
        material: railMaterial,
      }),
    )
  }
  for (let level = 0; level < 2; level++) {
    group.add(
      createBoxMesh({
        size: [FOAM_SHEET.lengthM, FOAM_INSERT_HEIGHT_M, FOAM_SHEET.widthM],
        position: [
          level * 0.012 - 0.012,
          MAT_THICKNESS_M + (level + 0.5) * FOAM_INSERT_HEIGHT_M,
          level * -0.01 + 0.01,
        ],
        material: FOAM_MATERIAL,
      }),
    )
  }

  const uncutSheet = new Group()
  uncutSheet.name = "uncut-foam-sheet"
  uncutSheet.add(
    createBoxMesh({
      size: [FOAM_SHEET.lengthM, FOAM_INSERT_HEIGHT_M, FOAM_SHEET.widthM],
      position: [0, SHEET_BASE_Y_M + FOAM_INSERT_HEIGHT_M / 2, 0],
      material: FOAM_MATERIAL,
    }),
  )
  const remainderShape = createRectangleShape({
    widthM: FOAM_SHEET.lengthM,
    depthM: FOAM_SHEET.widthM,
  })
  const profiles = [-0.09, 0.08].map((x) => {
    const center = new Vector3(x, FOAM_SHEET_SURFACE_Y_M, 0.2)
    const perimeter = rectangle(center, FOAM_INSERT.widthM, FOAM_INSERT.depthM)
    const pocket = rectangle(
      center,
      FOAM_INSERT.pocketWidthM,
      FOAM_INSERT.pocketDepthM,
    )
    for (const outline of [perimeter, pocket]) {
      const guide = new LineLoop(
        new BufferGeometry().setFromPoints(outline),
        guideMaterial,
      )
      guide.position.y = 0.001
      uncutSheet.add(guide)
    }
    const hole = rectangle(
      center,
      FOAM_INSERT.widthM + CUT_GAP_M,
      FOAM_INSERT.depthM + CUT_GAP_M,
    )
    remainderShape.holes.push(
      new Path(hole.map((corner) => new Vector2(corner.x, -corner.z))),
    )
    return { center, perimeter, pocket }
  })
  const cutSheet = createExtrudedMesh({
    shape: remainderShape,
    depthM: FOAM_INSERT_HEIGHT_M,
    material: FOAM_MATERIAL,
    baseYM: SHEET_BASE_Y_M,
  })
  cutSheet.name = "foam-sheet-offcut"
  cutSheet.visible = false
  group.add(uncutSheet, cutSheet)

  const gantry = new Group()
  gantry.position.z = CUTTER_HOME.z
  gantry.add(
    createBoxMesh({
      size: [1.34, 0.025, 0.033],
      position: [0, 0.23, BEAM_OFFSET_Z_M],
      material: railMaterial,
    }),
  )
  for (const x of [-0.65, 0.65]) {
    gantry.add(
      createBoxMesh({
        size: [0.038, 0.2, 0.06],
        position: [x, 0.13, BEAM_OFFSET_Z_M],
        material: frameMaterial,
      }),
    )
  }
  const head = new Group()
  head.position.set(CUTTER_HOME.x, CUTTER_HOME.y, 0)
  head.add(
    createBoxMesh({
      size: [0.065, 0.12, 0.073],
      position: [0, 0.195, -0.027],
      material: frameMaterial,
    }),
    createCylinderMesh({
      radiusTopM: 0.006,
      radiusBottomM: 0.002,
      heightM: 0.045,
      position: [0, FOAM_SHEET_SURFACE_Y_M + 0.0225, 0],
      material: railMaterial,
    }),
  )
  gantry.add(head)
  group.add(gantry)

  group.add(
    createBoxMesh({
      size: [0.11, 0.036, 0.085],
      position: [0.38, 0.018, 0.316],
      material: frameMaterial,
    }),
  )
  const startButton = createCylinderMesh({
    radiusTopM: 0.015,
    radiusBottomM: 0.015,
    heightM: 0.008,
    position: [0.38, 0.04, 0.316],
    material: createStandardMaterial({ color: 0x7bce79 }),
  })
  group.add(startButton)
  return { group, profiles, uncutSheet, cutSheet, gantry, head, startButton }
}
