import { Group, MeshBasicMaterial } from "three"
import { BOLT_HOLE_CORNERS } from "lib/models/nema17-motor"
import {
  createBoxMesh,
  createCircleHole,
  createDiscShape,
  createExtrudedMesh,
  createOctagonShape,
  createStandardMaterial,
} from "lib/scene/primitives"
import {
  BLACK_PLASTIC_MATERIAL,
  DARK_METAL_MATERIAL,
  STEEL_MATERIAL,
} from "lib/scene/shared-materials"

export const CONTROLLER_PCB = {
  faceSizeM: 0.042,
  thicknessM: 0.0016,
  boltPitchM: 0.031,
} as const

const PASSIVE_POSITIONS: Array<[number, number]> = [
  [-0.012, 0.009],
  [-0.008, 0.012],
  [0.004, 0.011],
  [0.009, 0.008],
  [0.011, -0.011],
]

/**
 * Stand-in for the motor controller PCB that mounts on the NEMA17 back face.
 * Origin is the bottom of the board.
 */
export function createControllerPcb(): Group {
  const pcb = new Group()
  const halfPitchM = CONTROLLER_PCB.boltPitchM / 2
  const goldMaterial = createStandardMaterial({
    color: 0xd9b24a,
    metalness: 0.8,
    roughness: 0.3,
  })
  const board = createOctagonShape({
    sizeM: CONTROLLER_PCB.faceSizeM,
    cornerClipM: 0.005,
  })
  for (const corner of BOLT_HOLE_CORNERS) {
    board.holes.push(
      createCircleHole({
        x: corner.xSign * halfPitchM,
        y: corner.zSign * halfPitchM,
        radiusM: 0.0017,
      }),
    )
  }
  pcb.add(
    createExtrudedMesh({
      shape: board,
      depthM: CONTROLLER_PCB.thicknessM,
      material: createStandardMaterial({ color: 0x14633a, roughness: 0.45 }),
    }),
  )
  for (const corner of BOLT_HOLE_CORNERS) {
    const pad = createDiscShape(0.0031)
    pad.holes.push(createCircleHole({ x: 0, y: 0, radiusM: 0.0017 }))
    const padMesh = createExtrudedMesh({
      shape: pad,
      depthM: 0.00005,
      material: goldMaterial,
      baseYM: CONTROLLER_PCB.thicknessM,
    })
    padMesh.position.x = corner.xSign * halfPitchM
    padMesh.position.z = corner.zSign * halfPitchM
    pcb.add(padMesh)
  }

  const topY = CONTROLLER_PCB.thicknessM
  pcb.add(
    // RP2040, driver and regulator packages
    createBoxMesh({
      size: [0.007, 0.0009, 0.007],
      material: BLACK_PLASTIC_MATERIAL,
      position: [-0.004, topY + 0.00045, 0.003],
    }),
    createBoxMesh({
      size: [0.005, 0.0009, 0.005],
      material: BLACK_PLASTIC_MATERIAL,
      position: [0.008, topY + 0.00045, -0.004],
    }),
    createBoxMesh({
      size: [0.004, 0.0009, 0.004],
      material: BLACK_PLASTIC_MATERIAL,
      position: [0, topY + 0.00045, -0.0005],
    }),
    // USB-C, motor connector and button
    createBoxMesh({
      size: [0.009, 0.0032, 0.0073],
      material: STEEL_MATERIAL,
      position: [0, topY + 0.0016, -0.017],
    }),
    createBoxMesh({
      size: [0.006, 0.004, 0.008],
      material: createStandardMaterial({ color: 0xf2f2ee }),
      position: [0.0175, topY + 0.002, 0.002],
    }),
    createBoxMesh({
      size: [0.004, 0.003, 0.004],
      material: DARK_METAL_MATERIAL,
      position: [-0.011, topY + 0.0015, -0.007],
    }),
    createBoxMesh({
      size: [0.0012, 0.0006, 0.0012],
      material: new MeshBasicMaterial({ color: 0x53ff9a }),
      position: [-0.015, topY + 0.0003, 0.004],
    }),
  )
  const passiveMaterial = createStandardMaterial({ color: 0xb08a5a })
  for (const [x, z] of PASSIVE_POSITIONS) {
    pcb.add(
      createBoxMesh({
        size: [0.0016, 0.0008, 0.0009],
        material: passiveMaterial,
        position: [x, topY + 0.0004, z],
      }),
    )
  }
  return pcb
}
