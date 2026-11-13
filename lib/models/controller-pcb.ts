import {
  type BoardPart,
  RP2040_BOARD,
  RP2040_BOARD_OUTLINE_MM,
  RP2040_BOARD_PARTS,
} from "lib/models/rp2040-board-layout"
import {
  createCircleHole,
  createDiscShape,
  createExtrudedMesh,
  createStandardMaterial,
} from "lib/scene/primitives"
import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  Group,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Shape,
  Vector3,
} from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"

const MM = 0.001

export const CONTROLLER_PCB = {
  faceSizeM: RP2040_BOARD.widthMm * MM,
  thicknessM: RP2040_BOARD.thicknessMm * MM,
  boltPitchM: RP2040_BOARD.mountingHolePitchMm * MM,
} as const

export const STATUS_LED_COLORS = {
  off: 0x22302a,
  idle: 0x53ff9a,
  running: 0x4aa3ff,
} as const

/**
 * The RP2040 NEMA17 motor controller (imrishabh18/rp2040-motor-controller)
 * that mounts on the motor's back face. Origin is the bottom of the board.
 * Each port anchor is the pose a plug takes when fully inserted, with the
 * plug's +Y pointing out of the port.
 *
 * The board is turned on the motor so its motor connector edge faces the
 * motor's own cable socket: board +X (the JST edge) is local -Z, and board +Y
 * (the USB-C edge) is local -X.
 */
export interface ControllerPcb {
  group: Group
  /** RGB status LED (D_STATUS). */
  statusLed: Mesh<BoxGeometry, MeshBasicMaterial>
  /** DATA USB-C: programs and runs the RP2040. */
  dataPort: Object3D
  /** PWR USB-C: requests motor power over USB PD (CH224K). */
  powerPort: Object3D
  /** Side-entry 4-pin JST PH (J1) for the motor cable's PHR-4 plug. */
  motorHeader: Object3D
}

type PartMaterialKey =
  | "black"
  | "ceramic"
  | "tinned"
  | "white"
  | "gold"
  | "silkscreen"
  | "darkCavity"

const PART_MATERIALS: Record<PartMaterialKey, Material> = {
  black: createStandardMaterial({ color: 0x1b1c1f, roughness: 0.55 }),
  ceramic: createStandardMaterial({ color: 0xb59468, roughness: 0.6 }),
  tinned: createStandardMaterial({
    color: 0xc9ccd1,
    metalness: 0.85,
    roughness: 0.3,
  }),
  white: createStandardMaterial({ color: 0xf1efe8, roughness: 0.5 }),
  gold: createStandardMaterial({
    color: 0xd9b24a,
    metalness: 0.8,
    roughness: 0.3,
  }),
  silkscreen: createStandardMaterial({ color: 0xf4f4ef, roughness: 0.7 }),
  darkCavity: createStandardMaterial({ color: 0x0b0c0e, roughness: 0.8 }),
}
const SOLDER_MASK_MATERIAL = createStandardMaterial({
  color: 0x0f5a31,
  roughness: 0.42,
})

/** Board millimetres to this model's local metres, X and Z. */
function toLocalXz(params: { xMm: number; yMm: number }): [number, number] {
  return [-params.yMm * MM, -params.xMm * MM]
}

/** A board-aligned box: `widthMm` along board X, `heightMm` along board Y. */
function createPartBox(params: {
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  baseMm: number
  tallMm: number
}): BufferGeometry {
  const geometry = new BoxGeometry(
    params.heightMm * MM,
    params.tallMm * MM,
    params.widthMm * MM,
  )
  const [x, z] = toLocalXz(params)
  geometry.translate(
    x,
    CONTROLLER_PCB.thicknessM + (params.baseMm + params.tallMm / 2) * MM,
    z,
  )
  return geometry
}

/** Body size for a footprint whose extent includes its pads. */
function getBodySizeMm(part: BoardPart): { widthMm: number; heightMm: number } {
  const isWide = part.widthMm >= part.heightMm
  const longMm = Math.max(part.widthMm, part.heightMm)
  if (part.kind === "resistor" || part.kind === "capacitor") {
    // 0402 and 0603 by pad extent; larger parts keep most of their footprint.
    const [bodyLongMm, bodyShortMm] =
      longMm < 1.7
        ? [1, 0.5]
        : longMm < 2.6
          ? [1.6, 0.8]
          : [longMm * 0.72, Math.min(part.widthMm, part.heightMm) * 0.8]
    return isWide
      ? { widthMm: bodyLongMm, heightMm: bodyShortMm }
      : { widthMm: bodyShortMm, heightMm: bodyLongMm }
  }
  return {
    widthMm: Math.min(part.widthMm * 0.85, part.widthMm - 0.6),
    heightMm: Math.min(part.heightMm * 0.85, part.heightMm - 0.6),
  }
}

function getPartLook(part: BoardPart): {
  materialKey: PartMaterialKey
  tallMm: number
} {
  const longMm = Math.max(part.widthMm, part.heightMm)
  if (part.kind === "capacitor")
    return {
      materialKey: "ceramic",
      tallMm: longMm < 1.7 ? 0.5 : longMm < 2.6 ? 0.8 : longMm > 6 ? 2.2 : 1.4,
    }
  if (part.kind === "resistor")
    return { materialKey: "black", tallMm: longMm > 3 ? 0.6 : 0.35 }
  if (part.kind === "crystal") return { materialKey: "tinned", tallMm: 0.8 }
  if (part.kind === "led") return { materialKey: "white", tallMm: 0.6 }
  if (part.kind === "button") return { materialKey: "tinned", tallMm: 0.9 }
  if (part.kind === "inductor") return { materialKey: "black", tallMm: 0.7 }
  if (part.kind === "diode" || part.kind === "fuse")
    return { materialKey: "black", tallMm: 1 }
  // ICs: SOIC current amplifiers stand taller than the QFN RP2040 and the driver.
  return {
    materialKey: "black",
    tallMm: longMm > 7 && longMm < 7.5 ? 1.5 : 0.9,
  }
}

function addEdgeConnectors(
  geometries: Record<PartMaterialKey, BufferGeometry[]>,
): void {
  const { usbBodyMm, usbMouthYMm, motorConnector, buzzer } = RP2040_BOARD
  for (const center of [
    RP2040_BOARD.dataUsbCenterMm,
    RP2040_BOARD.powerUsbCenterMm,
  ]) {
    geometries.tinned.push(
      createPartBox({
        ...center,
        widthMm: usbBodyMm.widthMm,
        heightMm: usbBodyMm.depthMm,
        baseMm: 0,
        tallMm: usbBodyMm.heightMm,
      }),
    )
    // The receptacle mouth: a dark oval slot on the edge face.
    geometries.darkCavity.push(
      createPartBox({
        xMm: center.xMm,
        yMm: usbMouthYMm + 0.03,
        widthMm: usbBodyMm.widthMm - 0.7,
        heightMm: 0.1,
        baseMm: 0.35,
        tallMm: usbBodyMm.heightMm - 0.7,
      }),
    )
  }
  const jstDepthMm = motorConnector.mouthXMm - motorConnector.backXMm
  geometries.white.push(
    createPartBox({
      xMm: motorConnector.backXMm + jstDepthMm / 2,
      yMm: motorConnector.centerYMm,
      widthMm: jstDepthMm,
      heightMm: motorConnector.lengthMm,
      baseMm: 0,
      tallMm: motorConnector.heightMm,
    }),
  )
  geometries.darkCavity.push(
    createPartBox({
      xMm: motorConnector.mouthXMm + 0.03,
      yMm: motorConnector.centerYMm,
      widthMm: 0.1,
      heightMm: motorConnector.lengthMm - 1.6,
      baseMm: 0.9,
      tallMm: motorConnector.heightMm - 1.8,
    }),
  )
  const buzzerBody = new CylinderGeometry(
    (buzzer.diameterMm / 2) * MM,
    (buzzer.diameterMm / 2) * MM,
    buzzer.heightMm * MM,
    28,
  )
  const [buzzerX, buzzerZ] = toLocalXz(buzzer)
  buzzerBody.translate(
    buzzerX,
    CONTROLLER_PCB.thicknessM + (buzzer.heightMm / 2) * MM,
    buzzerZ,
  )
  geometries.black.push(buzzerBody)
  const soundPort = new CylinderGeometry(0.0011, 0.0011, 0.0002, 16)
  soundPort.translate(
    buzzerX,
    CONTROLLER_PCB.thicknessM + buzzer.heightMm * MM + 0.0001,
    buzzerZ,
  )
  geometries.darkCavity.push(soundPort)
  for (const label of [RP2040_BOARD.dataLabelMm, RP2040_BOARD.powerLabelMm])
    geometries.silkscreen.push(
      createPartBox({ ...label, baseMm: 0, tallMm: 0.02 }),
    )
}

let sharedPartGeometries: Record<PartMaterialKey, BufferGeometry> | null = null

/** Every placed part, merged into one geometry per material and shared by all boards. */
function getPartGeometries(): Record<PartMaterialKey, BufferGeometry> {
  if (sharedPartGeometries) return sharedPartGeometries
  const geometries: Record<PartMaterialKey, BufferGeometry[]> = {
    black: [],
    ceramic: [],
    tinned: [],
    white: [],
    gold: [],
    silkscreen: [],
    darkCavity: [],
  }
  for (const part of RP2040_BOARD_PARTS) {
    // The status LED is its own mesh so each board can light it.
    if (part.kind === "rgb_led") continue
    const body = getBodySizeMm(part)
    const look = getPartLook(part)
    geometries[look.materialKey].push(
      createPartBox({
        xMm: part.xMm,
        yMm: part.yMm,
        ...body,
        baseMm: 0,
        tallMm: look.tallMm,
      }),
    )
    if (part.kind === "button") {
      // Black actuator on the tact switch.
      geometries.black.push(
        createPartBox({
          xMm: part.xMm,
          yMm: part.yMm,
          widthMm: 1.6,
          heightMm: 1.1,
          baseMm: look.tallMm,
          tallMm: 0.5,
        }),
      )
    }
  }
  addEdgeConnectors(geometries)
  const merged: Partial<Record<PartMaterialKey, BufferGeometry>> = {}
  for (const key of Object.keys(geometries) as PartMaterialKey[]) {
    const list = geometries[key]
    if (list.length > 0) merged[key] = mergeGeometries(list)
  }
  sharedPartGeometries = merged as Record<PartMaterialKey, BufferGeometry>
  return sharedPartGeometries
}

function createBoardShape(): Shape {
  const shape = new Shape()
  for (const [index, [xMm, yMm]] of RP2040_BOARD_OUTLINE_MM.entries()) {
    // Local X is -board Y, and the shape's Y maps to -Z, which is board X.
    const shapeX = -yMm * MM
    const shapeY = xMm * MM
    if (index === 0) shape.moveTo(shapeX, shapeY)
    else shape.lineTo(shapeX, shapeY)
  }
  shape.closePath()
  return shape
}

/** A plug pose: `outward` is where the plug's +Y points, `across` is its width (+X). */
function createPortAnchor(params: {
  position: [number, number, number]
  across: Vector3
  outward: Vector3
}): Object3D {
  const anchor = new Object3D()
  anchor.position.set(...params.position)
  const thickness = params.across.clone().cross(params.outward)
  anchor.quaternion.setFromRotationMatrix(
    new Matrix4().makeBasis(params.across, params.outward, thickness),
  )
  return anchor
}

export function createControllerPcb(): ControllerPcb {
  const group = new Group()
  const halfPitchM = CONTROLLER_PCB.boltPitchM / 2
  const holeRadiusM = (RP2040_BOARD.mountingHoleDiameterMm / 2) * MM
  const board = createBoardShape()
  const corners = [-1, 1].flatMap((xSign) =>
    [-1, 1].map((zSign) => ({ xSign, zSign })),
  )
  for (const corner of corners)
    board.holes.push(
      createCircleHole({
        x: corner.xSign * halfPitchM,
        y: corner.zSign * halfPitchM,
        radiusM: holeRadiusM,
      }),
    )
  group.add(
    createExtrudedMesh({
      shape: board,
      depthM: CONTROLLER_PCB.thicknessM,
      material: SOLDER_MASK_MATERIAL,
    }),
  )
  // Plated mounting rings, top and bottom.
  for (const corner of corners) {
    const ring = createDiscShape(0.0028)
    ring.holes.push(createCircleHole({ x: 0, y: 0, radiusM: holeRadiusM }))
    for (const baseYM of [CONTROLLER_PCB.thicknessM, -0.00005]) {
      const ringMesh = createExtrudedMesh({
        shape: ring,
        depthM: 0.00005,
        material: PART_MATERIALS.gold,
        baseYM,
      })
      ringMesh.position.x = corner.xSign * halfPitchM
      ringMesh.position.z = corner.zSign * halfPitchM
      group.add(ringMesh)
    }
  }
  for (const [key, geometry] of Object.entries(getPartGeometries())) {
    const mesh = new Mesh(geometry, PART_MATERIALS[key as PartMaterialKey])
    mesh.castShadow = key !== "silkscreen" && key !== "darkCavity"
    mesh.receiveShadow = true
    group.add(mesh)
  }

  const topY = CONTROLLER_PCB.thicknessM
  const ledPart = RP2040_BOARD_PARTS.find((part) => part.kind === "rgb_led")
  const [ledX, ledZ] = ledPart ? toLocalXz(ledPart) : [0, 0]
  const statusLed = new Mesh(
    new BoxGeometry(0.0015, 0.0007, 0.0015),
    new MeshBasicMaterial({ color: STATUS_LED_COLORS.off }),
  )
  statusLed.position.set(ledX, topY + 0.00035, ledZ)
  group.add(statusLed)

  const { usbBodyMm, usbMouthYMm, motorConnector } = RP2040_BOARD
  const usbPortY = topY + (usbBodyMm.heightMm / 2) * MM
  const [usbMouthX] = toLocalXz({ xMm: 0, yMm: usbMouthYMm })
  // Plugs come out of the USB-C edge (local -X), lying flat: wide along Z, thin vertically.
  const outOfUsbEdge = {
    across: new Vector3(0, 0, 1),
    outward: new Vector3(-1, 0, 0),
  }
  const dataPort = createPortAnchor({
    position: [usbMouthX, usbPortY, toLocalXz(RP2040_BOARD.dataUsbCenterMm)[1]],
    ...outOfUsbEdge,
  })
  const powerPort = createPortAnchor({
    position: [
      usbMouthX,
      usbPortY,
      toLocalXz(RP2040_BOARD.powerUsbCenterMm)[1],
    ],
    ...outOfUsbEdge,
  })
  // The PHR-4 lies flat and slides in parallel to the board from its +X edge (local -Z).
  const [motorHeaderX, motorHeaderZ] = toLocalXz({
    xMm: motorConnector.mouthXMm,
    yMm: motorConnector.centerYMm,
  })
  const motorHeader = createPortAnchor({
    position: [
      motorHeaderX,
      topY + (motorConnector.heightMm / 2) * MM,
      motorHeaderZ,
    ],
    across: new Vector3(1, 0, 0),
    outward: new Vector3(0, 0, -1),
  })
  group.add(dataPort, powerPort, motorHeader)
  return { group, statusLed, dataPort, powerPort, motorHeader }
}
