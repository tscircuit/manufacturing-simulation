import { Group, type Material, Object3D } from "three"
import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"

export const MAILER_BOX = {
  lengthM: 0.116,
  widthM: 0.076,
  heightM: 0.064,
  boardThicknessM: 0.003,
  tuckFlapLengthM: 0.02,
} as const

/** A wall panel hinged at the base. Rotate `fold.rotation.z` to π/2 to stand it up. */
export interface MailerBoxWall {
  fold: Group
  /** Free edge of the panel, where a hand pushes it. */
  tip: Object3D
}

/**
 * Flat mailer box blank: base, four hinged walls, and a lid with a tuck flap
 * hinged off the back wall. Origin is the centre of the base underside.
 */
export interface MailerBox {
  group: Group
  leftWall: MailerBoxWall
  rightWall: MailerBoxWall
  frontWall: MailerBoxWall
  backWall: MailerBoxWall
  /** Rotate `rotation.z` to π/2 to close. */
  lid: Group
  /** Rotate `rotation.z` to π/2 to tuck. */
  tuckFlap: Group
  lidTip: Object3D
}

function createHingedWall(params: {
  box: Group
  hingeCcwYawRadians: number
  hingeX: number
  hingeZ: number
  panelLengthM: number
  material: Material
}): MailerBoxWall {
  const hinge = new Group()
  hinge.position.set(
    params.hingeX,
    MAILER_BOX.boardThicknessM / 2,
    params.hingeZ,
  )
  hinge.rotation.y = params.hingeCcwYawRadians
  const fold = new Group()
  hinge.add(fold)
  fold.add(
    createBoxMesh({
      size: [
        MAILER_BOX.heightM,
        MAILER_BOX.boardThicknessM,
        params.panelLengthM,
      ],
      material: params.material,
      position: [MAILER_BOX.heightM / 2, 0, 0],
    }),
  )
  const tip = new Object3D()
  tip.position.x = MAILER_BOX.heightM
  fold.add(tip)
  params.box.add(hinge)
  return { fold, tip }
}

export function createMailerBox(): MailerBox {
  const group = new Group()
  const cardboard = createStandardMaterial({ color: 0xb98f5e, roughness: 0.95 })
  const { lengthM, widthM, boardThicknessM, tuckFlapLengthM } = MAILER_BOX
  group.add(
    createBoxMesh({
      size: [lengthM, boardThicknessM, widthM],
      material: cardboard,
      position: [0, boardThicknessM / 2, 0],
    }),
  )
  const leftWall = createHingedWall({
    box: group,
    hingeCcwYawRadians: Math.PI,
    hingeX: -lengthM / 2,
    hingeZ: 0,
    panelLengthM: widthM,
    material: cardboard,
  })
  const rightWall = createHingedWall({
    box: group,
    hingeCcwYawRadians: 0,
    hingeX: lengthM / 2,
    hingeZ: 0,
    panelLengthM: widthM,
    material: cardboard,
  })
  const frontWall = createHingedWall({
    box: group,
    hingeCcwYawRadians: -Math.PI / 2,
    hingeX: 0,
    hingeZ: widthM / 2,
    panelLengthM: lengthM,
    material: cardboard,
  })
  const backWall = createHingedWall({
    box: group,
    hingeCcwYawRadians: Math.PI / 2,
    hingeX: 0,
    hingeZ: -widthM / 2,
    panelLengthM: lengthM,
    material: cardboard,
  })

  const lid = new Group()
  lid.position.x = MAILER_BOX.heightM
  backWall.fold.add(lid)
  lid.add(
    createBoxMesh({
      size: [widthM, boardThicknessM, lengthM],
      material: cardboard,
      position: [widthM / 2, 0, 0],
    }),
  )
  const tuckFlap = new Group()
  tuckFlap.position.x = widthM
  lid.add(tuckFlap)
  tuckFlap.add(
    createBoxMesh({
      size: [tuckFlapLengthM, boardThicknessM, lengthM - 0.012],
      material: cardboard,
      position: [tuckFlapLengthM / 2, 0, 0],
    }),
  )
  const lidTip = new Object3D()
  lidTip.position.x = widthM - 0.005
  lid.add(lidTip)

  return {
    group,
    leftWall,
    rightWall,
    frontWall,
    backWall,
    lid,
    tuckFlap,
    lidTip,
  }
}
