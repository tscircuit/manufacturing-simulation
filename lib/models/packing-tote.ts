import { BATCH_SIZE } from "lib/layout/station-layout"
import { WHITE_MAILER_BOX } from "lib/models/white-mailer-box"
import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { Group, Object3D } from "three"

const COLUMNS = 2
const ROWS = 3
const LAYERS = Math.ceil(BATCH_SIZE / (COLUMNS * ROWS))
const WALL_M = 0.004

export const PACKING_TOTE = {
  innerWidthM: COLUMNS * WHITE_MAILER_BOX.lengthM + 0.012,
  innerDepthM: ROWS * WHITE_MAILER_BOX.widthM + 0.012,
  innerHeightM: LAYERS * WHITE_MAILER_BOX.heightM + 0.02,
} as const

/** Open tote that holds one batch of packed mailers, 2 x 3 x 5, carried from pack-out to ship-ready. Origin on its base. */
export interface PackingTote {
  group: Group
  /** Which unit (index) sits in each slot, or null. */
  occupants: Array<number | null>
  slots: Object3D[]
  leftHandle: Object3D
  rightHandle: Object3D
}

export function createPackingTote(): PackingTote {
  const group = new Group()
  const material = createStandardMaterial({ color: 0x3d6b4f, roughness: 0.7 })
  const { innerWidthM, innerDepthM, innerHeightM } = PACKING_TOTE
  const outerWidthM = innerWidthM + 2 * WALL_M
  const outerDepthM = innerDepthM + 2 * WALL_M
  group.add(
    createBoxMesh({
      size: [outerWidthM, WALL_M, outerDepthM],
      material,
      position: [0, WALL_M / 2, 0],
    }),
    createBoxMesh({
      size: [outerWidthM, innerHeightM, WALL_M],
      material,
      position: [0, innerHeightM / 2, -outerDepthM / 2 + WALL_M / 2],
    }),
    createBoxMesh({
      size: [outerWidthM, innerHeightM, WALL_M],
      material,
      position: [0, innerHeightM / 2, outerDepthM / 2 - WALL_M / 2],
    }),
    createBoxMesh({
      size: [WALL_M, innerHeightM, outerDepthM],
      material,
      position: [-outerWidthM / 2 + WALL_M / 2, innerHeightM / 2, 0],
    }),
    createBoxMesh({
      size: [WALL_M, innerHeightM, outerDepthM],
      material,
      position: [outerWidthM / 2 - WALL_M / 2, innerHeightM / 2, 0],
    }),
  )
  const slots: Object3D[] = []
  for (let layer = 0; layer < LAYERS; layer++) {
    for (let row = 0; row < ROWS; row++) {
      for (let column = 0; column < COLUMNS; column++) {
        const slot = new Object3D()
        slot.position.set(
          (column - (COLUMNS - 1) / 2) * (WHITE_MAILER_BOX.lengthM + 0.004),
          WALL_M + layer * WHITE_MAILER_BOX.heightM,
          (row - (ROWS - 1) / 2) * (WHITE_MAILER_BOX.widthM + 0.004),
        )
        group.add(slot)
        slots.push(slot)
      }
    }
  }
  const leftHandle = new Object3D()
  leftHandle.position.set(-outerWidthM / 2, innerHeightM - 0.02, 0)
  const rightHandle = new Object3D()
  rightHandle.position.set(outerWidthM / 2, innerHeightM - 0.02, 0)
  group.add(leftHandle, rightHandle)
  return {
    group,
    slots,
    occupants: slots.map(() => null),
    leftHandle,
    rightHandle,
  }
}
