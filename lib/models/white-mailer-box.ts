import { USB_CHARGER } from "lib/models/usb-charger"
import {
  createBoxMesh,
  createExtrudedMesh,
  createRectangleShape,
  createStandardMaterial,
} from "lib/scene/primitives"
import { Group, Object3D, Path, type Shape } from "three"

/**
 * The Boxery white corrugated tuck mailer, 7" x 4" x 3" inside, with a hinged
 * lid. Origin under the centre of the base.
 */
export const WHITE_MAILER_BOX = {
  lengthM: 0.184,
  widthM: 0.108,
  heightM: 0.079,
  boardThicknessM: 0.003,
  bottomFoamSlabM: 0.01,
  bottomFoamHeightM: 0.04,
  lidFoamThicknessM: 0.008,
  /** Lid rotation (about the back hinge) when fully open. */
  lidOpenRadians: -1.95,
} as const

/** Where each item sits in the bottom foam, in box coordinates (X along the length, Z toward the front). */
export const BOX_POCKETS = {
  motor: { x: -0.045, z: -0.005, widthM: 0.088, depthM: 0.052 },
  /** Both coiled USB-C cables stack in this pocket. */
  usbCables: { x: 0.045, z: 0.027, widthM: 0.05, depthM: 0.046 },
  charger: {
    x: 0.045,
    z: -0.026,
    widthM: USB_CHARGER.widthM + 0.004,
    depthM: USB_CHARGER.depthM + 0.004,
  },
} as const

export interface WhiteMailerBox {
  group: Group
  /** Hinged at the back top edge. Rotate `rotation.x` to `lidOpenRadians` to open. */
  lid: Group
  /** Front edge of the lid, where a finger lifts it. */
  lidTip: Object3D
  /** Where the product label goes: near the left end of the closed lid, in lid coordinates. */
  stickerSpot: Object3D
}

/** Pink anti-static foam color. */
const PINK_FOAM_COLOR = 0xf48fb8

function addPocket(params: {
  foam: Shape
  pocket: { x: number; z: number; widthM: number; depthM: number }
}): void {
  const { pocket } = params
  // Shape Y maps to world -Z after extrusion.
  const offsetHole = new Path()
  const halfWidth = pocket.widthM / 2
  const halfDepth = pocket.depthM / 2
  offsetHole.moveTo(pocket.x - halfWidth, -pocket.z - halfDepth)
  offsetHole.lineTo(pocket.x + halfWidth, -pocket.z - halfDepth)
  offsetHole.lineTo(pocket.x + halfWidth, -pocket.z + halfDepth)
  offsetHole.lineTo(pocket.x - halfWidth, -pocket.z + halfDepth)
  offsetHole.closePath()
  params.foam.holes.push(offsetHole)
}

export function createWhiteMailerBox(): WhiteMailerBox {
  const group = new Group()
  const board = createStandardMaterial({ color: 0xf7f7f4, roughness: 0.85 })
  const foam = createStandardMaterial({ color: PINK_FOAM_COLOR, roughness: 1 })
  const b = WHITE_MAILER_BOX
  const t = b.boardThicknessM
  group.add(
    createBoxMesh({
      size: [b.lengthM, t, b.widthM],
      material: board,
      position: [0, t / 2, 0],
    }),
    createBoxMesh({
      size: [b.lengthM, b.heightM, t],
      material: board,
      position: [0, b.heightM / 2, -b.widthM / 2 + t / 2],
    }),
    createBoxMesh({
      size: [b.lengthM, b.heightM, t],
      material: board,
      position: [0, b.heightM / 2, b.widthM / 2 - t / 2],
    }),
    createBoxMesh({
      size: [t, b.heightM, b.widthM],
      material: board,
      position: [-b.lengthM / 2 + t / 2, b.heightM / 2, 0],
    }),
    createBoxMesh({
      size: [t, b.heightM, b.widthM],
      material: board,
      position: [b.lengthM / 2 - t / 2, b.heightM / 2, 0],
    }),
  )

  const innerLengthM = b.lengthM - 2 * t
  const innerWidthM = b.widthM - 2 * t
  const pocketFrame = createRectangleShape({
    widthM: innerLengthM,
    depthM: innerWidthM,
  })
  for (const pocket of Object.values(BOX_POCKETS))
    addPocket({ foam: pocketFrame, pocket })
  group.add(
    createBoxMesh({
      size: [innerLengthM, b.bottomFoamSlabM, innerWidthM],
      material: foam,
      position: [0, t + b.bottomFoamSlabM / 2, 0],
    }),
    createExtrudedMesh({
      shape: pocketFrame,
      depthM: b.bottomFoamHeightM - b.bottomFoamSlabM,
      material: foam,
      baseYM: t + b.bottomFoamSlabM,
    }),
  )

  const lid = new Group()
  lid.position.set(0, b.heightM, -b.widthM / 2)
  group.add(lid)
  lid.add(
    createBoxMesh({
      size: [b.lengthM, t, b.widthM],
      material: board,
      position: [0, t / 2, b.widthM / 2],
    }),
    createBoxMesh({
      size: [b.lengthM - 0.01, 0.022, t],
      material: board,
      position: [0, -0.011, b.widthM - t * 1.5],
    }),
    createBoxMesh({
      size: [innerLengthM - 0.004, b.lidFoamThicknessM, innerWidthM - 0.004],
      material: foam,
      position: [0, -b.lidFoamThicknessM / 2, b.widthM / 2],
    }),
  )
  const lidTip = new Object3D()
  lidTip.position.set(0, t, b.widthM)
  const stickerSpot = new Object3D()
  stickerSpot.position.set(-b.lengthM / 2 + 0.034, t, b.widthM / 2)
  lid.add(lidTip, stickerSpot)
  return { group, lid, lidTip, stickerSpot }
}

/** Height of the pocket floor (top of the bottom foam slab) above the box origin. */
export const POCKET_FLOOR_YM =
  WHITE_MAILER_BOX.boardThicknessM + WHITE_MAILER_BOX.bottomFoamSlabM
