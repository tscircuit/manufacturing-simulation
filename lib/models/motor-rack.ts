import { BATCH_SIZE } from "lib/layout/station-layout"
import {
  createBoxMesh,
  createCircleHole,
  createExtrudedMesh,
  createRectangleShape,
  createStandardMaterial,
} from "lib/scene/primitives"
import { Group, Object3D } from "three"

/** One batch in rows of five motors. */
const RACK_COLUMNS = 5
const RACK_ROWS = Math.ceil(BATCH_SIZE / RACK_COLUMNS)
const SLOT_PITCH_M = 0.056

export const MOTOR_RACK = {
  widthM: RACK_COLUMNS * SLOT_PITCH_M + 0.03,
  depthM: RACK_ROWS * SLOT_PITCH_M + 0.02,
  heightM: 0.032,
  handleOverhangM: 0.03,
} as const

/**
 * A carry rack, or the foam stand the raw motors arrive on. Each slot is the
 * pose of a motor's mounting face; motors stand back face up with the shaft
 * in the slot's hole.
 */
export interface MotorRack {
  group: Group
  /** Which unit (index) sits in each slot, or null. */
  occupants: Array<number | null>
  slots: Object3D[]
  /** Grab points at each end of the rack, in rack coordinates. */
  leftHandle: Object3D
  rightHandle: Object3D
}

function getSlotOffsets(): Array<{ x: number; z: number }> {
  const offsets: Array<{ x: number; z: number }> = []
  for (let row = 0; row < RACK_ROWS; row++) {
    for (let column = 0; column < RACK_COLUMNS; column++) {
      offsets.push({
        x: (column - (RACK_COLUMNS - 1) / 2) * SLOT_PITCH_M,
        // Fill from the front row (+Z, nearest the operator) back.
        z: ((RACK_ROWS - 1) / 2 - row) * SLOT_PITCH_M,
      })
    }
  }
  return offsets
}

function createRackBody(params: {
  color: number
  roughness: number
  holeRadiusM: number
}): {
  group: Group
  slots: Object3D[]
} {
  const group = new Group()
  const { widthM, depthM, heightM } = MOTOR_RACK
  const body = createRectangleShape({ widthM, depthM })
  const offsets = getSlotOffsets()
  // Shape Y maps to -Z after extrusion.
  for (const offset of offsets)
    body.holes.push(
      createCircleHole({
        x: offset.x,
        y: -offset.z,
        radiusM: params.holeRadiusM,
      }),
    )
  group.add(
    createExtrudedMesh({
      shape: body,
      depthM: heightM,
      material: createStandardMaterial({
        color: params.color,
        roughness: params.roughness,
      }),
    }),
  )
  const slots = offsets.map((offset) => {
    const slot = new Object3D()
    slot.position.set(offset.x, heightM, offset.z)
    group.add(slot)
    return slot
  })
  return { group, slots }
}

/** ESD-blue carry rack with handles at both ends, for moving a batch between benches. */
export function createMotorRack(): MotorRack {
  const { group, slots } = createRackBody({
    color: 0x2c64a8,
    roughness: 0.5,
    holeRadiusM: 0.013,
  })
  const handleMaterial = createStandardMaterial({
    color: 0x1f2a36,
    roughness: 0.5,
  })
  const { widthM, heightM, handleOverhangM } = MOTOR_RACK
  const handleX = widthM / 2 + handleOverhangM / 2
  for (const sideX of [-1, 1]) {
    group.add(
      createBoxMesh({
        size: [handleOverhangM, 0.012, 0.09],
        material: handleMaterial,
        position: [sideX * handleX, heightM - 0.006, 0],
      }),
    )
  }
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

/** Black foam stand the raw NEMA17 motors sit in, one batch to a stand. */
export function createMotorFoamStand(): MotorRack {
  const { group, slots } = createRackBody({
    color: 0x23262b,
    roughness: 1,
    holeRadiusM: 0.013,
  })
  return {
    group,
    slots,
    occupants: slots.map(() => null),
    leftHandle: slots[0],
    rightHandle: slots[slots.length - 1],
  }
}
