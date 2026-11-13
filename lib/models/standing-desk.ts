import { WORK_TABLE } from "lib/layout/station-layout"
import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { Group, MeshBasicMaterial } from "three"

/**
 * Electric standing desk: laminate top on a two-column steel frame with
 * T-feet, a crossbar under the top, and a height keypad on the front edge.
 * Long axis is local X, origin on the floor, operator on the +Z side.
 */
export function createStandingDesk(): Group {
  const desk = new Group()
  const { lengthM, depthM, topHeightM, topThicknessM } = WORK_TABLE
  const top = createStandardMaterial({ color: 0xd9cfbd, roughness: 0.75 })
  const edge = createStandardMaterial({ color: 0x3a3d42, roughness: 0.6 })
  const frame = createStandardMaterial({
    color: 0x2b2e33,
    metalness: 0.55,
    roughness: 0.45,
  })
  const frameTopYM = topHeightM - topThicknessM
  desk.add(
    createBoxMesh({
      size: [lengthM, topThicknessM, depthM],
      material: top,
      position: [0, topHeightM - topThicknessM / 2, 0],
    }),
    createBoxMesh({
      size: [lengthM + 0.002, topThicknessM * 0.6, 0.004],
      material: edge,
      position: [0, topHeightM - topThicknessM / 2, depthM / 2],
    }),
    // Crossbar and side rails under the top
    createBoxMesh({
      size: [lengthM - 0.32, 0.04, 0.04],
      material: frame,
      position: [0, frameTopYM - 0.02, -0.05],
    }),
  )
  for (const sideX of [-1, 1]) {
    const columnX = sideX * (lengthM / 2 - 0.16)
    desk.add(
      createBoxMesh({
        size: [0.05, 0.03, depthM - 0.08],
        material: frame,
        position: [columnX, frameTopYM - 0.015, 0],
      }),
      // Telescoping column: wide outer stage, slimmer inner stages
      createBoxMesh({
        size: [0.08, 0.36, 0.06],
        material: frame,
        position: [columnX, 0.04 + 0.18, -0.05],
      }),
      createBoxMesh({
        size: [0.07, 0.33, 0.052],
        material: frame,
        position: [columnX, 0.4 + 0.165, -0.05],
      }),
      createBoxMesh({
        size: [0.062, frameTopYM - 0.73, 0.046],
        material: frame,
        position: [columnX, 0.73 + (frameTopYM - 0.73) / 2, -0.05],
      }),
      // T-foot with levellers
      createBoxMesh({
        size: [0.07, 0.04, depthM - 0.04],
        material: frame,
        position: [columnX, 0.025, 0],
      }),
      createBoxMesh({
        size: [0.04, 0.01, 0.04],
        material: edge,
        position: [columnX, 0.005, depthM / 2 - 0.05],
      }),
      createBoxMesh({
        size: [0.04, 0.01, 0.04],
        material: edge,
        position: [columnX, 0.005, -depthM / 2 + 0.05],
      }),
    )
  }
  desk.add(
    createBoxMesh({
      size: [0.12, 0.02, 0.05],
      material: edge,
      position: [lengthM / 2 - 0.25, frameTopYM - 0.012, depthM / 2 - 0.03],
    }),
    createBoxMesh({
      size: [0.03, 0.002, 0.012],
      material: new MeshBasicMaterial({ color: 0x8fd3ff }),
      position: [
        lengthM / 2 - 0.25,
        frameTopYM - 0.002 - 0.012 + 0.0115,
        depthM / 2 - 0.005,
      ],
    }),
  )
  return desk
}
