import { Group } from "three"
import { FOLDING_TABLE } from "lib/layout/station-layout"
import {
  createBoxMesh,
  createCylinderMesh,
  createStandardMaterial,
} from "lib/scene/primitives"

const TOP_THICKNESS_M = 0.045

/** 6' plastic folding table. Long axis is local X, origin on the floor. */
export function createFoldingTable(): Group {
  const table = new Group()
  const topMaterial = createStandardMaterial({
    color: 0xe6e4dd,
    roughness: 0.85,
  })
  const legMaterial = createStandardMaterial({
    color: 0x6f757c,
    metalness: 0.6,
    roughness: 0.45,
  })
  const { lengthM, depthM, topHeightM } = FOLDING_TABLE
  table.add(
    createBoxMesh({
      size: [lengthM, TOP_THICKNESS_M, depthM],
      material: topMaterial,
      position: [0, topHeightM - TOP_THICKNESS_M / 2, 0],
    }),
  )
  const legHeightM = topHeightM - TOP_THICKNESS_M
  for (const legX of [-0.7, 0.7]) {
    for (const legZ of [-0.28, 0.28]) {
      table.add(
        createCylinderMesh({
          radiusTopM: 0.014,
          radiusBottomM: 0.014,
          heightM: legHeightM,
          material: legMaterial,
          position: [legX, legHeightM / 2, legZ],
          radialSegments: 10,
        }),
      )
    }
    table.add(
      createBoxMesh({
        size: [0.025, 0.025, 0.56],
        material: legMaterial,
        position: [legX, 0.2, 0],
      }),
    )
  }
  return table
}
