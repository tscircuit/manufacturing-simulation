import { BACKFACE_SPACER } from "lib/models/backface-spacer"
import { CONTROLLER_PCB } from "lib/models/controller-pcb"
import { SCREW_POUCH } from "lib/models/screw-pouch"
import { Group, Object3D } from "three"

/**
 * What goes in the bare unit's outer bag, and where it lies, in two piles
 * side by side: the controller board on its 4 mm backface spacer, and the
 * coiled motor-to-board cable with the folded screw pouch on top of it.
 *
 * Sizes behind the 80 x 120 mm outer bag (see docs/bare-unit-packaging.md):
 * - board + spacer: 43.6 x 42.3 mm, 10.4 mm high (4 mm spacer, 1.6 mm board,
 *   4.8 mm side-entry JST);
 * - cable coil: about 46 x 46 x 5 mm; folded screw pouch: 51 x 38 x 7 mm;
 * - side by side: 51 x 91 mm, 12 mm thick at most, which needs about
 *   69 x 115 mm inside a flat zip bag. The Ellbest 80 x 120 mm bag fits.
 */
export const PART_KIT = {
  boardPileThicknessM: 0.0104,
  cablePileThicknessM: 0.005 + 2 * SCREW_POUCH.thicknessM,
  /** Centre-to-centre of the two piles. */
  pileSpacingM: 0.049,
} as const

export interface PartKit {
  group: Group
  spacerSpot: Object3D
  pcbSpot: Object3D
  cableSpot: Object3D
  pouchSpot: Object3D
  /** The coiled cable once it is in. */
  cable: Group | null
  /** The screw pouch once it is in. */
  screwPouch: Group | null
}

function createSpot(position: [number, number, number]): Object3D {
  const spot = new Object3D()
  spot.position.set(...position)
  return spot
}

/** Origin at the bottom centre between the two piles; the piles sit along Z. */
export function createPartKit(): PartKit {
  const group = new Group()
  const boardZ = PART_KIT.pileSpacingM / 2
  const cableZ = -PART_KIT.pileSpacingM / 2
  const spacerSpot = createSpot([0, 0, boardZ])
  const pcbSpot = createSpot([
    0,
    BACKFACE_SPACER.baseHeightM + BACKFACE_SPACER.sleeveHeightM,
    boardZ,
  ])
  const cableSpot = createSpot([0, 0, cableZ])
  const pouchSpot = createSpot([0, 0.005, cableZ])
  group.add(spacerSpot, pcbSpot, cableSpot, pouchSpot)
  return {
    group,
    spacerSpot,
    pcbSpot,
    cableSpot,
    pouchSpot,
    cable: null,
    screwPouch: null,
  }
}

/** The board's thickness on the spacer, for checks. */
export const BOARD_ON_SPACER_M =
  BACKFACE_SPACER.baseHeightM +
  BACKFACE_SPACER.sleeveHeightM +
  CONTROLLER_PCB.thicknessM
