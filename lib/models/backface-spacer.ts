import { Group } from "three"
import { BOLT_HOLE_CORNERS } from "lib/models/nema17-motor"
import {
  createCircleHole,
  createDiscShape,
  createExtrudedMesh,
  createOctagonShape,
  createStandardMaterial,
} from "lib/scene/primitives"

/** Dimensions from backface-spacer-4mm.scad on motorcontrol.tscircuit.com. */
export const BACKFACE_SPACER = {
  faceSizeM: 0.042,
  boltPitchM: 0.031,
  baseHeightM: 0.001,
  sleeveHeightM: 0.003,
  sleeveOuterDiameterM: 0.01,
  screwClearanceDiameterM: 0.0034,
  rotorClearanceDiameterM: 0.0226,
  cornerClipM: 0.005,
} as const

/** 4 mm NEMA17 backface spacer: 1 mm base plus four 3 mm sleeves. Origin on its base. */
/** One spacer built once; every spacer is a clone sharing its geometry and material. */
let spacerTemplate: Group | null = null

export function createBackfaceSpacer(): Group {
  spacerTemplate ??= buildBackfaceSpacer()
  return spacerTemplate.clone()
}

function buildBackfaceSpacer(): Group {
  const spacer = new Group()
  const printMaterial = createStandardMaterial({
    color: 0xf07a1c,
    roughness: 0.8,
  })
  const s = BACKFACE_SPACER
  const halfPitchM = s.boltPitchM / 2
  const screwHoleRadiusM = s.screwClearanceDiameterM / 2

  const base = createOctagonShape({
    sizeM: s.faceSizeM,
    cornerClipM: s.cornerClipM,
  })
  base.holes.push(
    createCircleHole({ x: 0, y: 0, radiusM: s.rotorClearanceDiameterM / 2 }),
  )
  for (const corner of BOLT_HOLE_CORNERS) {
    base.holes.push(
      createCircleHole({
        x: corner.xSign * halfPitchM,
        y: corner.zSign * halfPitchM,
        radiusM: screwHoleRadiusM,
      }),
    )
  }
  spacer.add(
    createExtrudedMesh({
      shape: base,
      depthM: s.baseHeightM,
      material: printMaterial,
    }),
  )

  for (const corner of BOLT_HOLE_CORNERS) {
    const sleeve = createDiscShape(s.sleeveOuterDiameterM / 2)
    sleeve.holes.push(
      createCircleHole({ x: 0, y: 0, radiusM: screwHoleRadiusM }),
    )
    const sleeveMesh = createExtrudedMesh({
      shape: sleeve,
      depthM: s.sleeveHeightM,
      material: printMaterial,
      baseYM: s.baseHeightM,
    })
    sleeveMesh.position.x = corner.xSign * halfPitchM
    sleeveMesh.position.z = corner.zSign * halfPitchM
    spacer.add(sleeveMesh)
  }
  return spacer
}
