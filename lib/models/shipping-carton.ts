import { WHITE_MAILER_BOX } from "lib/models/white-mailer-box"
import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { METERS_PER_INCH } from "lib/units"
import { Group, Object3D } from "three"

/**
 * Amazon FBA shipping carton for 30 packed units. The packed 7x4x3 mailers
 * (outer ~7.25 x 4.25 x 3.1 in) stack 2 x 3 x 5 = 30 in a 14.5 x 12.75 x
 * 15.6 in block, so a 15 x 13 x 17 in (inside) carton fits them with a little
 * room for void fill. About 37 lb packed, under the FBA 50 lb carton limit.
 */
export const SHIPPING_CARTON = {
  innerLengthM: 15 * METERS_PER_INCH,
  innerWidthM: 13 * METERS_PER_INCH,
  innerHeightM: 17 * METERS_PER_INCH,
  boardThicknessM: 0.005,
  columns: 2,
  rows: 3,
  layers: 5,
} as const

export const SHIPPING_CARTON_CAPACITY =
  SHIPPING_CARTON.columns * SHIPPING_CARTON.rows * SHIPPING_CARTON.layers

/** Origin under the centre of the carton; the top flaps start open. */
export interface ShippingCarton {
  group: Group
  /** Which unit (index) sits in each slot, or null. */
  occupants: Array<number | null>
  /** Pose of each mailer, filled bottom layer first. */
  slots: Object3D[]
  /** Long flaps on the front/back edges and short flaps on the ends; rotate `rotation.x` / `rotation.z` to close. */
  frontFlap: Group
  backFlap: Group
  leftFlap: Group
  rightFlap: Group
  /** Packing tape along the closed seam; scale X from 0 to 1 to apply. */
  tape: Group
  leftGrip: Object3D
  rightGrip: Object3D
}

/** How far each flap is folded open, in radians. */
export const CARTON_FLAP_OPEN_RADIANS = 2.2

export function createShippingCarton(): ShippingCarton {
  const group = new Group()
  const board = createStandardMaterial({ color: 0xc49a6c, roughness: 0.95 })
  const c = SHIPPING_CARTON
  const t = c.boardThicknessM
  const lengthM = c.innerLengthM + 2 * t
  const widthM = c.innerWidthM + 2 * t
  const heightM = c.innerHeightM + t
  group.add(
    createBoxMesh({
      size: [lengthM, t, widthM],
      material: board,
      position: [0, t / 2, 0],
    }),
    createBoxMesh({
      size: [lengthM, heightM, t],
      material: board,
      position: [0, heightM / 2, -widthM / 2 + t / 2],
    }),
    createBoxMesh({
      size: [lengthM, heightM, t],
      material: board,
      position: [0, heightM / 2, widthM / 2 - t / 2],
    }),
    createBoxMesh({
      size: [t, heightM, widthM],
      material: board,
      position: [-lengthM / 2 + t / 2, heightM / 2, 0],
    }),
    createBoxMesh({
      size: [t, heightM, widthM],
      material: board,
      position: [lengthM / 2 - t / 2, heightM / 2, 0],
    }),
  )

  // Long flaps meet in the middle; short flaps tuck under them.
  const frontFlap = new Group()
  frontFlap.position.set(0, heightM, widthM / 2)
  frontFlap.add(
    createBoxMesh({
      size: [lengthM, t, widthM / 2],
      material: board,
      position: [0, t / 2, -widthM / 4],
    }),
  )
  frontFlap.rotation.x = -CARTON_FLAP_OPEN_RADIANS
  const backFlap = new Group()
  backFlap.position.set(0, heightM, -widthM / 2)
  backFlap.add(
    createBoxMesh({
      size: [lengthM, t, widthM / 2],
      material: board,
      position: [0, t / 2, widthM / 4],
    }),
  )
  backFlap.rotation.x = CARTON_FLAP_OPEN_RADIANS
  const leftFlap = new Group()
  leftFlap.position.set(-lengthM / 2, heightM - t, 0)
  leftFlap.add(
    createBoxMesh({
      size: [lengthM * 0.35, t, widthM - 0.01],
      material: board,
      position: [lengthM * 0.175, t / 2, 0],
    }),
  )
  leftFlap.rotation.z = CARTON_FLAP_OPEN_RADIANS
  const rightFlap = new Group()
  rightFlap.position.set(lengthM / 2, heightM - t, 0)
  rightFlap.add(
    createBoxMesh({
      size: [lengthM * 0.35, t, widthM - 0.01],
      material: board,
      position: [-lengthM * 0.175, t / 2, 0],
    }),
  )
  rightFlap.rotation.z = -CARTON_FLAP_OPEN_RADIANS
  group.add(frontFlap, backFlap, leftFlap, rightFlap)

  const tape = new Group()
  tape.position.set(-lengthM / 2 - 0.05, heightM + t + 0.0004, 0)
  tape.add(
    createBoxMesh({
      size: [lengthM + 0.1, 0.0006, 0.048],
      material: createStandardMaterial({
        color: 0xb48a52,
        roughness: 0.35,
        transparent: true,
        opacity: 0.85,
      }),
      position: [(lengthM + 0.1) / 2, 0, 0],
    }),
  )
  tape.scale.x = 0.001
  tape.visible = false
  group.add(tape)

  const slots: Object3D[] = []
  const mailer = WHITE_MAILER_BOX
  for (let layer = 0; layer < c.layers; layer++) {
    for (let row = 0; row < c.rows; row++) {
      for (let column = 0; column < c.columns; column++) {
        const slot = new Object3D()
        slot.position.set(
          (column - (c.columns - 1) / 2) * (mailer.lengthM + 0.002),
          t + layer * mailer.heightM,
          (row - (c.rows - 1) / 2) * (mailer.widthM + 0.002),
        )
        group.add(slot)
        slots.push(slot)
      }
    }
  }
  const leftGrip = new Object3D()
  leftGrip.position.set(-lengthM / 2, heightM * 0.7, 0)
  const rightGrip = new Object3D()
  rightGrip.position.set(lengthM / 2, heightM * 0.7, 0)
  group.add(leftGrip, rightGrip)
  return {
    group,
    slots,
    occupants: slots.map(() => null),
    frontFlap,
    backFlap,
    leftFlap,
    rightFlap,
    tape,
    leftGrip,
    rightGrip,
  }
}
