import {
  BoxGeometry,
  Euler,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
} from "three"
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
  STEEL_MATERIAL,
} from "lib/scene/shared-materials"

export const CONTROLLER_PCB = {
  faceSizeM: 0.042,
  thicknessM: 0.0016,
  boltPitchM: 0.031,
} as const

export const STATUS_LED_COLORS = {
  off: 0x22302a,
  idle: 0x53ff9a,
  running: 0x4aa3ff,
} as const

/**
 * Motor controller PCB that mounts on the NEMA17 back face. Origin is the
 * bottom of the board. Each port anchor is the pose a plug takes when fully
 * inserted, with the plug's +Y pointing out of the port.
 */
export interface ControllerPcb {
  group: Group
  statusLed: Mesh<BoxGeometry, MeshBasicMaterial>
  /** USB-C used to program and run the board. */
  dataPort: Object3D
  /** USB-C that requests motor power over USB PD. */
  powerPort: Object3D
  /** Vertical JST-PH header for the motor cable. */
  motorHeader: Object3D
}

const PASSIVE_POSITIONS: Array<[number, number]> = [
  [-0.012, 0.009],
  [-0.008, 0.012],
  [0.004, 0.011],
  [0.009, 0.008],
  [0.011, -0.011],
]

function createPortAnchor(params: {
  position: [number, number, number]
  rotation: Euler
}): Object3D {
  const anchor = new Object3D()
  anchor.position.set(...params.position)
  anchor.rotation.copy(params.rotation)
  return anchor
}

export function createControllerPcb(): ControllerPcb {
  const group = new Group()
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
  group.add(
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
    group.add(padMesh)
  }

  const topY = CONTROLLER_PCB.thicknessM
  group.add(
    // RP2040, motor driver and regulator
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
    // USB-C receptacles on two edges
    createBoxMesh({
      size: [0.009, 0.0032, 0.0073],
      material: STEEL_MATERIAL,
      position: [0, topY + 0.0016, -0.0175],
    }),
    createBoxMesh({
      size: [0.0073, 0.0032, 0.009],
      material: STEEL_MATERIAL,
      position: [-0.0175, topY + 0.0016, 0.004],
    }),
    // JST-PH motor header
    createBoxMesh({
      size: [0.006, 0.004, 0.012],
      material: createStandardMaterial({ color: 0xf2f2ee }),
      position: [0.0155, topY + 0.002, 0.004],
    }),
  )
  const passiveMaterial = createStandardMaterial({ color: 0xb08a5a })
  for (const [x, z] of PASSIVE_POSITIONS) {
    group.add(
      createBoxMesh({
        size: [0.0016, 0.0008, 0.0009],
        material: passiveMaterial,
        position: [x, topY + 0.0004, z],
      }),
    )
  }
  const statusLed = new Mesh(
    new BoxGeometry(0.0014, 0.0007, 0.0014),
    new MeshBasicMaterial({ color: STATUS_LED_COLORS.off }),
  )
  statusLed.position.set(-0.012, topY + 0.00035, -0.004)
  group.add(statusLed)

  const portY = topY + 0.0016
  const dataPort = createPortAnchor({
    position: [0, portY, -0.0212],
    rotation: new Euler(-Math.PI / 2, 0, 0),
  })
  const powerPort = createPortAnchor({
    position: [-0.0212, portY, 0.004],
    rotation: new Euler(0, 0, Math.PI / 2),
  })
  const motorHeader = createPortAnchor({
    position: [0.0155, topY + 0.004, 0.004],
    rotation: new Euler(0, 0, 0),
  })
  group.add(dataPort, powerPort, motorHeader)
  return { group, statusLed, dataPort, powerPort, motorHeader }
}
