import {
  DoubleSide,
  Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  type MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
} from "three"
import { FLOOR_PLAN } from "lib/layout/floor-plan"
import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { DOOR_WOOD_MATERIAL } from "lib/scene/shared-materials"

export interface RoomShell {
  group: Group
  /** Exposed so the viewer can apply a tile texture and theme colours. */
  floorMaterial: MeshStandardMaterial
  wallMaterial: MeshStandardMaterial
}

const ROOM_CENTER = {
  x: FLOOR_PLAN.widthM / 2,
  z: FLOOR_PLAN.eastLengthM / 2,
}

/**
 * Single-sided wall panel facing into the room, so walls never block the view
 * from a camera outside the room.
 */
function createWallPanel(params: {
  fromX: number
  fromZ: number
  toX: number
  toZ: number
  bottomYM: number
  topYM: number
  material: Material
}): Mesh {
  const { fromX, fromZ, toX, toZ, bottomYM, topYM } = params
  const lengthM = Math.hypot(toX - fromX, toZ - fromZ)
  const panel = new Mesh(
    new PlaneGeometry(lengthM, topYM - bottomYM),
    params.material,
  )
  let normalX = -(toZ - fromZ) / lengthM
  let normalZ = (toX - fromX) / lengthM
  const midX = (fromX + toX) / 2
  const midZ = (fromZ + toZ) / 2
  if (normalX * (ROOM_CENTER.x - midX) + normalZ * (ROOM_CENTER.z - midZ) < 0) {
    normalX = -normalX
    normalZ = -normalZ
  }
  panel.position.set(midX, (bottomYM + topYM) / 2, midZ)
  panel.rotation.y = Math.atan2(normalX, normalZ)
  panel.receiveShadow = true
  return panel
}

function createFloor(material: Material): Mesh {
  const { widthM, eastLengthM, westLengthM, southNotchWidthM } = FLOOR_PLAN
  const outline = new Shape()
  outline.moveTo(0, 0)
  outline.lineTo(widthM, 0)
  outline.lineTo(widthM, eastLengthM)
  outline.lineTo(southNotchWidthM, eastLengthM)
  outline.lineTo(southNotchWidthM, westLengthM)
  outline.lineTo(0, westLengthM)
  outline.closePath()
  const geometry = new ShapeGeometry(outline)
  geometry.rotateX(Math.PI / 2)
  const floor = new Mesh(geometry, material)
  floor.receiveShadow = true
  return floor
}

function createWashroom(wallMaterial: Material): Group {
  const washroom = new Group()
  const { widthM, wallHeightM } = FLOOR_PLAN
  const { westWallXM, northWallZM, southWallZM, doorNorthZM, doorSouthZM } =
    FLOOR_PLAN.washroom
  const wallThicknessM = 0.1
  const doorHeightM = 2.05
  const eastWestLengthM = widthM - westWallXM
  const eastWestCenterX = (westWallXM + widthM) / 2
  washroom.add(
    createBoxMesh({
      size: [eastWestLengthM, wallHeightM, wallThicknessM],
      material: wallMaterial,
      position: [eastWestCenterX, wallHeightM / 2, northWallZM],
    }),
    createBoxMesh({
      size: [eastWestLengthM, wallHeightM, wallThicknessM],
      material: wallMaterial,
      position: [eastWestCenterX, wallHeightM / 2, southWallZM],
    }),
    createBoxMesh({
      size: [wallThicknessM, wallHeightM, doorNorthZM - northWallZM],
      material: wallMaterial,
      position: [westWallXM, wallHeightM / 2, (northWallZM + doorNorthZM) / 2],
    }),
    createBoxMesh({
      size: [wallThicknessM, wallHeightM, southWallZM - doorSouthZM],
      material: wallMaterial,
      position: [westWallXM, wallHeightM / 2, (doorSouthZM + southWallZM) / 2],
    }),
    createBoxMesh({
      size: [
        wallThicknessM,
        wallHeightM - doorHeightM,
        doorSouthZM - doorNorthZM,
      ],
      material: wallMaterial,
      position: [
        westWallXM,
        doorHeightM + (wallHeightM - doorHeightM) / 2,
        (doorNorthZM + doorSouthZM) / 2,
      ],
    }),
  )
  const door = new Group()
  door.position.set(westWallXM, 0, doorNorthZM)
  door.rotation.y = -0.5
  door.add(
    createBoxMesh({
      size: [0.04, 2.03, doorSouthZM - doorNorthZM],
      material: DOOR_WOOD_MATERIAL,
      position: [0, 1.015, (doorSouthZM - doorNorthZM) / 2],
    }),
  )
  const porcelain = createStandardMaterial({ color: 0xf4f4f0, roughness: 0.3 })
  washroom.add(
    door,
    createBoxMesh({
      size: [0.38, 0.4, 0.5],
      material: porcelain,
      position: [widthM - 0.32, 0.2, southWallZM - 0.5],
    }),
    createBoxMesh({
      size: [0.4, 0.42, 0.18],
      material: porcelain,
      position: [widthM - 0.3, 0.6, southWallZM - 0.16],
    }),
    createBoxMesh({
      size: [0.42, 0.12, 0.36],
      material: porcelain,
      position: [widthM - 0.3, 0.82, northWallZM + 0.4],
    }),
  )
  return washroom
}

/** Floor, walls, windows, washroom and doors of unit 322. */
export function createRoomShell(): RoomShell {
  const group = new Group()
  const floorMaterial = createStandardMaterial({
    color: 0xcccccc,
    roughness: 0.95,
    side: DoubleSide,
  })
  const wallMaterial = createStandardMaterial({
    color: 0xeeeeee,
    roughness: 0.95,
  })
  const trimMaterial = createStandardMaterial({ color: 0x7b8794 })
  const glassMaterial = new MeshBasicMaterial({
    color: 0x9fd0ee,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  })
  const {
    widthM,
    eastLengthM,
    westLengthM,
    southNotchWidthM,
    wallHeightM,
    entryDoorWidthM,
    windowSillHeightM,
    windowHeadHeightM,
  } = FLOOR_PLAN
  const doorHeightM = 2.1
  const wallSegments: Array<
    [number, number, number, number, number, number, Material]
  > = [
    [0, 0, widthM, 0, 0, wallHeightM, wallMaterial],
    [
      widthM,
      entryDoorWidthM,
      widthM,
      eastLengthM,
      0,
      wallHeightM,
      wallMaterial,
    ],
    [
      widthM,
      0,
      widthM,
      entryDoorWidthM,
      doorHeightM,
      wallHeightM,
      wallMaterial,
    ],
    [
      widthM,
      eastLengthM,
      southNotchWidthM,
      eastLengthM,
      0,
      wallHeightM,
      wallMaterial,
    ],
    [
      southNotchWidthM,
      eastLengthM,
      southNotchWidthM,
      westLengthM,
      0,
      wallHeightM,
      wallMaterial,
    ],
    [
      southNotchWidthM,
      westLengthM,
      0,
      westLengthM,
      0,
      wallHeightM,
      wallMaterial,
    ],
    [0, westLengthM, 0, 0, 0, windowSillHeightM, wallMaterial],
    [0, westLengthM, 0, 0, windowHeadHeightM, wallHeightM, wallMaterial],
    [0, westLengthM, 0, 0, windowSillHeightM, windowHeadHeightM, glassMaterial],
  ]
  group.add(createFloor(floorMaterial))
  for (const [
    fromX,
    fromZ,
    toX,
    toZ,
    bottomYM,
    topYM,
    material,
  ] of wallSegments) {
    group.add(
      createWallPanel({ fromX, fromZ, toX, toZ, bottomYM, topYM, material }),
    )
  }
  const mullionHeightM = windowHeadHeightM - windowSillHeightM
  for (const mullionZ of FLOOR_PLAN.windowMullionZPositionsM) {
    group.add(
      createBoxMesh({
        size: [0.04, mullionHeightM, 0.04],
        material: trimMaterial,
        position: [0.02, windowSillHeightM + mullionHeightM / 2, mullionZ],
      }),
    )
  }
  group.add(
    createBoxMesh({
      size: [0.12, wallHeightM, 0.9],
      material: wallMaterial,
      position: [0.06, wallHeightM / 2, FLOOR_PLAN.windowColumnZM],
    }),
  )
  const entryDoor = new Group()
  entryDoor.position.set(widthM - 0.02, 0, 0.06)
  entryDoor.rotation.y = -1.25
  entryDoor.add(
    createBoxMesh({
      size: [0.045, 2.05, 1.1],
      material: DOOR_WOOD_MATERIAL,
      position: [0, 1.025, 0.55],
    }),
  )
  group.add(entryDoor, createWashroom(wallMaterial))
  return { group, floorMaterial, wallMaterial }
}
