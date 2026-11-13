import { ESD_BAG } from "lib/models/esd-bag"
import { WHITE_MAILER_BOX } from "lib/models/white-mailer-box"
import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { METERS_PER_INCH } from "lib/units"
import { Group, type Mesh, Object3D } from "three"

/**
 * Amazon FBA shipping carton for 30 packed units. The packed 7x4x3 mailers
 * (outer ~7.25 x 4.25 x 3.1 in) stack 2 x 3 x 5 = 30 in a 14.5 x 12.75 x
 * 15.6 in block, so a 15 x 13 x 17 in (inside) carton fits them with a little
 * room for void fill. About 37 lb packed, under the FBA 50 lb carton limit.
 */
/** A carton's inside size and the grid its items pack into. */
export interface CartonSpec {
  innerLengthM: number
  innerWidthM: number
  innerHeightM: number
  boardThicknessM: number
  /** Items along the length (X), across the width (Z) and stacked up. */
  columns: number
  rows: number
  layers: number
  itemPitchXM: number
  itemPitchZM: number
  itemHeightM: number
}

export const SHIPPING_CARTON = {
  innerLengthM: 15 * METERS_PER_INCH,
  innerWidthM: 13 * METERS_PER_INCH,
  innerHeightM: 17 * METERS_PER_INCH,
  boardThicknessM: 0.005,
  columns: 2,
  rows: 3,
  layers: 5,
  itemPitchXM: WHITE_MAILER_BOX.lengthM + 0.002,
  itemPitchZM: WHITE_MAILER_BOX.widthM + 0.002,
  itemHeightM: WHITE_MAILER_BOX.heightM,
} as const satisfies CartonSpec

/**
 * FBA carton for 30 bare units in 4" x 6" ESD bags, standing on edge 5 along
 * by 6 across: 21 x 12 x 7 in inside. About 0.33 kg a bagged unit, so roughly
 * 23 lb packed, under the FBA 50 lb limit and 25 in per side.
 */
export const BAG_SHIPPING_CARTON = {
  innerLengthM: 21 * METERS_PER_INCH,
  innerWidthM: 12 * METERS_PER_INCH,
  innerHeightM: 7 * METERS_PER_INCH,
  boardThicknessM: 0.005,
  columns: 5,
  rows: 6,
  layers: 1,
  itemPitchXM: ESD_BAG.widthM + 0.002,
  itemPitchZM: ESD_BAG.filledDepthM + 0.002,
  itemHeightM: ESD_BAG.heightM,
} as const satisfies CartonSpec

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
  /** Packing tape along the closed seam, from the left end; scale X from 0 to 1 to apply. */
  tape: Group
  /** Where the tape folds down over each end face: show the left one as taping starts, the right one as it finishes. */
  tapeEndTabs: [Mesh, Mesh]
  /** Length of the seam, end to end. */
  tapeLengthM: number
  leftGrip: Object3D
  rightGrip: Object3D
}

/** How far each flap is folded open, in radians. */
export const CARTON_FLAP_OPEN_RADIANS = 2.2

export function createShippingCarton(
  spec: CartonSpec = SHIPPING_CARTON,
): ShippingCarton {
  const group = new Group()
  const board = createStandardMaterial({ color: 0xc49a6c, roughness: 0.95 })
  const c = spec
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
  // Open flaps stand up and lean out, like the short ones, so all four close from above.
  frontFlap.rotation.x = CARTON_FLAP_OPEN_RADIANS
  const backFlap = new Group()
  backFlap.position.set(0, heightM, -widthM / 2)
  backFlap.add(
    createBoxMesh({
      size: [lengthM, t, widthM / 2],
      material: board,
      position: [0, t / 2, widthM / 4],
    }),
  )
  backFlap.rotation.x = -CARTON_FLAP_OPEN_RADIANS
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

  // 48 mm tape lying on the closed long flaps, from one end edge to the other.
  const tapeMaterial = createStandardMaterial({
    color: 0xb48a52,
    roughness: 0.35,
    transparent: true,
    opacity: 0.88,
  })
  const tapeTopYM = heightM + t
  const tape = new Group()
  tape.position.set(-lengthM / 2, tapeTopYM + 0.0003, 0)
  tape.add(
    createBoxMesh({
      size: [lengthM, 0.0006, 0.048],
      material: tapeMaterial,
      position: [lengthM / 2, 0, 0],
    }),
  )
  tape.scale.x = 0.001
  tape.visible = false
  group.add(tape)
  // The tape wraps 60 mm down each end face, stuck flat to the board.
  const tapeTabDropM = 0.06
  const tapeEndTabs = [-1, 1].map((side) => {
    const tab = createBoxMesh({
      size: [0.0006, tapeTabDropM, 0.048],
      material: tapeMaterial,
      position: [
        side * (lengthM / 2 + 0.0003),
        tapeTopYM - tapeTabDropM / 2,
        0,
      ],
    })
    tab.visible = false
    group.add(tab)
    return tab
  }) as [Mesh, Mesh]

  const slots: Object3D[] = []
  for (let layer = 0; layer < c.layers; layer++) {
    for (let row = 0; row < c.rows; row++) {
      for (let column = 0; column < c.columns; column++) {
        const slot = new Object3D()
        slot.position.set(
          (column - (c.columns - 1) / 2) * c.itemPitchXM,
          t + layer * c.itemHeightM,
          (row - (c.rows - 1) / 2) * c.itemPitchZM,
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
    tapeEndTabs,
    tapeLengthM: lengthM,
    leftGrip,
    rightGrip,
  }
}
