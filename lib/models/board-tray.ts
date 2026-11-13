import { BATCH_SIZE } from "lib/layout/station-layout"
import type { MotorRack } from "lib/models/motor-rack"
import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { Group, Object3D } from "three"

/** 6 columns (along X) by 5 rows (along Z): one batch of 30 boards. */
const TRAY_COLUMNS = 6
const TRAY_ROWS = BATCH_SIZE / TRAY_COLUMNS
const POCKET_PITCH_M = 0.05
const POCKET_SIZE_M = 0.046

export const BOARD_TRAY = {
  widthM: TRAY_COLUMNS * POCKET_PITCH_M + 0.02,
  depthM: TRAY_ROWS * POCKET_PITCH_M + 0.02,
  /** Rim height; each pocket floor sits 3 mm below it. */
  heightM: 0.012,
  pocketDepthM: 0.003,
  handleOverhangM: 0.03,
} as const

/**
 * Black conductive ESD tray for bare boards: 30 shallow 46 mm pockets, one
 * board lying flat in each, with finger grips at both ends so a full tray can
 * be carried between benches. Each slot is the pose of a board's underside.
 */
export function createBoardTray(params: { rimColor: number }): MotorRack {
  const group = new Group()
  const tray = createStandardMaterial({ color: 0x23262b, roughness: 0.7 })
  const rim = createStandardMaterial({ color: params.rimColor, roughness: 0.5 })
  const { widthM, depthM, heightM, pocketDepthM, handleOverhangM } = BOARD_TRAY
  const floorY = heightM - pocketDepthM
  group.add(
    createBoxMesh({
      size: [widthM, floorY, depthM],
      material: tray,
      position: [0, floorY / 2, 0],
    }),
  )
  // The walls between pockets, standing above the pocket floors.
  for (let column = 0; column <= TRAY_COLUMNS; column++)
    group.add(
      createBoxMesh({
        size: [POCKET_PITCH_M - POCKET_SIZE_M + 0.002, pocketDepthM, depthM],
        material: tray,
        position: [
          (column - TRAY_COLUMNS / 2) * POCKET_PITCH_M,
          floorY + pocketDepthM / 2,
          0,
        ],
      }),
    )
  for (let row = 0; row <= TRAY_ROWS; row++)
    group.add(
      createBoxMesh({
        size: [widthM, pocketDepthM, POCKET_PITCH_M - POCKET_SIZE_M + 0.002],
        material: tray,
        position: [
          0,
          floorY + pocketDepthM / 2,
          (row - TRAY_ROWS / 2) * POCKET_PITCH_M,
        ],
      }),
    )
  // Coloured rim so the untested and passed trays are told apart at a glance.
  group.add(
    createBoxMesh({
      size: [widthM, 0.002, 0.008],
      material: rim,
      position: [0, heightM + 0.001, depthM / 2 - 0.004],
    }),
  )
  const slots: Object3D[] = []
  for (let row = 0; row < TRAY_ROWS; row++) {
    for (let column = 0; column < TRAY_COLUMNS; column++) {
      const slot = new Object3D()
      slot.position.set(
        (column - (TRAY_COLUMNS - 1) / 2) * POCKET_PITCH_M,
        floorY + 0.0002,
        // Fill from the front row (+Z, nearest the operator) back.
        ((TRAY_ROWS - 1) / 2 - row) * POCKET_PITCH_M,
      )
      group.add(slot)
      slots.push(slot)
    }
  }
  const handleX = widthM / 2 + handleOverhangM / 2
  for (const sideX of [-1, 1])
    group.add(
      createBoxMesh({
        size: [handleOverhangM, 0.008, 0.08],
        material: tray,
        position: [sideX * handleX, heightM - 0.004, 0],
      }),
    )
  const leftHandle = new Object3D()
  leftHandle.position.set(-handleX, heightM, 0)
  const rightHandle = new Object3D()
  rightHandle.position.set(handleX, heightM, 0)
  group.add(leftHandle, rightHandle)
  return {
    group,
    slots,
    occupants: slots.map(() => null),
    leftHandle,
    rightHandle,
  }
}
