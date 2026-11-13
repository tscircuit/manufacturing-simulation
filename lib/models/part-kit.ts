import { BACKFACE_SPACER } from "lib/models/backface-spacer"
import { CONTROLLER_PCB } from "lib/models/controller-pcb"
import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { METERS_PER_INCH } from "lib/units"
import { SCREW_LYING_QUATERNION } from "lib/world/bench-spots"
import { Group, Object3D, Vector3 } from "three"

/**
 * The bare unit's parts, gathered at the kitting bench and bagged together:
 * the controller board on its 4 mm backface spacer, the four long M3 screws
 * in their own small pink anti-static pouch (so they can't scratch the
 * board), and the coiled motor-to-board cable. No motor.
 *
 * Sizes behind the 3" x 5" outer bag (see docs/bare-unit-packaging.md):
 * - board + spacer: 43.6 x 42.3 mm, 10.4 mm high (4 mm spacer, 1.6 mm board,
 *   4.8 mm side-entry JST);
 * - cable coil: about 46 x 46 x 5 mm; screw pouch (2" x 3" folded in half):
 *   51 x 38 x 5 mm;
 * - side by side in the bag: 51 x 91 mm, 10.4 mm thick, which needs about
 *   67 x 113 mm inside a flat zip bag. 3" x 5" (76 x 127 mm) fits.
 */
export const PART_KIT = {
  boardPileThicknessM: 0.0104,
  /** Centre-to-centre of the two piles in the bag. */
  bagPileSpacingM: 0.049,
} as const

/** The screw pouch: a pink anti-static 2" x 3" zip bag, folded to 2" x 1.5". */
export const SCREW_POUCH = {
  widthM: 2 * METERS_PER_INCH,
  foldedLengthM: 1.5 * METERS_PER_INCH,
  thicknessM: 0.005,
} as const

/** Rack layout stacks everything on the board; bag layout puts the cable and screws beside it. */
export type PartKitLayout = "rack" | "bag"

export interface PartKit {
  group: Group
  spacerSpot: Object3D
  pcbSpot: Object3D
  pouchSpot: Object3D
  cableSpot: Object3D
  /** The screw pouch, with a spot for each screw inside. */
  screwPouch: Group
  screwSpots: Object3D[]
  /** The coiled cable once it is in the kit. */
  cable: Group | null
  /** Each part placed so far and the spot it sits on, so a re-layout can move it. */
  placed: Array<{ part: Object3D; spot: Object3D }>
}

/** Height of the board's tallest parts (the side-entry JST and the buzzer). */
const PCB_PARTS_HEIGHT_M = 0.0048
const PCB_Y_M = BACKFACE_SPACER.baseHeightM + BACKFACE_SPACER.sleeveHeightM
const BOARD_TOP_Y_M = PCB_Y_M + CONTROLLER_PCB.thicknessM + PCB_PARTS_HEIGHT_M
const POUCH_MATERIAL = createStandardMaterial({
  color: 0xf2a7c3,
  roughness: 0.4,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
})

/** Spot positions (kit-local, origin at the bottom centre) for each layout. */
const LAYOUTS: Record<
  PartKitLayout,
  Record<"spacer" | "pcb" | "pouch" | "cable", [number, number, number]>
> = {
  // Stacked to fit a 56 mm rack slot: spacer, board, screw pouch, cable.
  rack: {
    spacer: [0, 0, 0],
    pcb: [0, PCB_Y_M, 0],
    pouch: [0, BOARD_TOP_Y_M, 0],
    cable: [0, BOARD_TOP_Y_M + SCREW_POUCH.thicknessM, 0],
  },
  // Two piles in the bag: board on its spacer, and the cable under the pouch.
  bag: {
    spacer: [0, 0, PART_KIT.bagPileSpacingM / 2],
    pcb: [0, PCB_Y_M, PART_KIT.bagPileSpacingM / 2],
    cable: [0, 0, -PART_KIT.bagPileSpacingM / 2],
    pouch: [0, 0.0045, -PART_KIT.bagPileSpacingM / 2],
  },
}

function createScrewPouch(): { group: Group; screwSpots: Object3D[] } {
  const group = new Group()
  group.add(
    createBoxMesh({
      size: [
        SCREW_POUCH.widthM,
        SCREW_POUCH.thicknessM,
        SCREW_POUCH.foldedLengthM,
      ],
      material: POUCH_MATERIAL,
      position: [0, SCREW_POUCH.thicknessM / 2, 0],
    }),
  )
  const screwSpots = [0, 1, 2, 3].map((index) => {
    const spot = new Object3D()
    spot.position.set((index - 1.5) * 0.0065, 0.0028, 0)
    spot.quaternion.copy(SCREW_LYING_QUATERNION)
    group.add(spot)
    return spot
  })
  return { group, screwSpots }
}

export function createPartKit(): PartKit {
  const group = new Group()
  const spacerSpot = new Object3D()
  const pcbSpot = new Object3D()
  const pouchSpot = new Object3D()
  const cableSpot = new Object3D()
  group.add(spacerSpot, pcbSpot, pouchSpot, cableSpot)
  const { group: screwPouch, screwSpots } = createScrewPouch()
  const kit: PartKit = {
    group,
    spacerSpot,
    pcbSpot,
    pouchSpot,
    cableSpot,
    screwPouch,
    screwSpots,
    cable: null,
    placed: [],
  }
  setPartKitLayout({ kit, layout: "rack" })
  return kit
}

/** Move the spots (and anything placed on them) toward a layout: `progress` 0..1 from where they were. */
export function setPartKitLayout(params: {
  kit: PartKit
  layout: PartKitLayout
  progress?: number
  /** Spot positions to blend from; defaults to their current positions. */
  from?: Map<Object3D, Vector3>
}): void {
  const { kit } = params
  const layout = LAYOUTS[params.layout]
  const progress = params.progress ?? 1
  const spots: Array<[Object3D, [number, number, number]]> = [
    [kit.spacerSpot, layout.spacer],
    [kit.pcbSpot, layout.pcb],
    [kit.pouchSpot, layout.pouch],
    [kit.cableSpot, layout.cable],
  ]
  for (const [spot, [x, y, z]] of spots) {
    const start = params.from?.get(spot) ?? spot.position.clone()
    spot.position.lerpVectors(start, new Vector3(x, y, z), progress)
  }
  for (const { part, spot } of kit.placed) part.position.copy(spot.position)
}

/** The kit's spot positions now, to blend a re-layout from. */
export function getPartKitSpotPositions(kit: PartKit): Map<Object3D, Vector3> {
  return new Map(
    [kit.spacerSpot, kit.pcbSpot, kit.pouchSpot, kit.cableSpot].map((spot) => [
      spot,
      spot.position.clone(),
    ]),
  )
}
