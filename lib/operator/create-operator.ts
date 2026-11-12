import {
  CapsuleGeometry,
  Group,
  LatheGeometry,
  type Material,
  Mesh,
  type Object3D,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three"
import {
  OPERATOR_BODY,
  RELAXED_FINGER_CURL,
  RELAXED_FINGER_DIRECTION,
} from "lib/operator/operator-body"
import {
  createCylinderMesh,
  createSphereMesh,
  createStandardMaterial,
} from "lib/scene/primitives"

/** +1 is the operator's left (local +X), -1 is the right. */
export type BodySide = 1 | -1

export interface OperatorFinger {
  proximal: Group
  distal: Group
}

export interface OperatorHand {
  side: BodySide
  hand: Group
  fingers: OperatorFinger[]
  thumb: Group
  shoulder: Mesh
  upperArm: Mesh
  elbow: Mesh
  forearm: Mesh
  wrist: Mesh
  /** World-space point the pinch point is moving to. */
  targetPosition: Vector3
  /** When set, `targetPosition` follows this every frame. */
  trackTarget: (() => Vector3) | null
  isReaching: boolean
  /** 0 = arm hanging relaxed, 1 = pinch point on target. */
  reachBlend: number
  fingerDirection: Vector3
  targetFingerDirection: Vector3
  fingerCurl: number
  targetFingerCurl: number
  heldObject: Object3D | null
}

export interface OperatorLeg {
  side: BodySide
  hip: Mesh
  thigh: Mesh
  knee: Mesh
  shin: Mesh
  foot: Mesh
}

/** Operator-local frame: origin between the feet on the floor, facing +Z. */
export interface Operator {
  group: Group
  torso: Group
  head: Group
  legs: OperatorLeg[]
  leftHand: OperatorHand
  rightHand: OperatorHand
  hands: OperatorHand[]
  /**
   * Body and head materials, so the viewer can fade them out of the camera's
   * way. Forearms and hands use their own material and stay solid, so the work
   * stays visible.
   */
  materials: Material[]
  /** Forearm and hand material; faded only when the camera is inside the operator. */
  handMaterials: Material[]
  position: Vector3
  ccwYawRadians: number
  walkSpeedMps: number
  gaitPhaseRadians: number
  /** 0 = standing still, 1 = full stride. */
  gaitBlend: number
  hipBendRadians: number
}

interface OperatorMaterials {
  shirt: Material
  pants: Material
  skin: Material
  /** Forearms and hands: never faded. */
  handSkin: Material
  shoe: Material
  hair: Material
  belt: Material
  lips: Material
  eyeWhite: Material
  iris: Material
}

/** Finger x offset, proximal and distal lengths, index to little finger. */
const FINGER_LAYOUT: Array<{ x: number; proximalM: number; distalM: number }> =
  [
    { x: 0.026, proximalM: 0.042, distalM: 0.034 },
    { x: 0.009, proximalM: 0.046, distalM: 0.037 },
    { x: -0.009, proximalM: 0.044, distalM: 0.035 },
    { x: -0.025, proximalM: 0.035, distalM: 0.028 },
  ]

function createScaledSphere(params: {
  radii: [number, number, number]
  material: Material
  position: [number, number, number]
}): Mesh {
  const mesh = new Mesh(new SphereGeometry(1, 20, 14), params.material)
  mesh.scale.set(...params.radii)
  mesh.position.set(...params.position)
  mesh.castShadow = true
  return mesh
}

function createLimbSegment(params: {
  radiusTopM: number
  radiusBottomM: number
  material: Material
}): Mesh {
  // Unit height; stretched along Y to the segment length each frame.
  return createCylinderMesh({ ...params, heightM: 1, radialSegments: 16 })
}

/** Body of revolution through `(radius, height)` points, flattened front to back. */
function createLathe(params: {
  profile: Array<[number, number]>
  material: Material
  depthScale: number
}): Mesh {
  const mesh = new Mesh(
    new LatheGeometry(
      params.profile.map(([radius, height]) => new Vector2(radius, height)),
      28,
    ),
    params.material,
  )
  mesh.scale.z = params.depthScale
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/** Hair cap: the top of a sphere, tilted back so it frames the forehead and covers the crown and nape. */
function createHairCap(params: {
  radii: [number, number, number]
  position: [number, number, number]
  thetaLength: number
  backwardTiltRadians: number
  material: Material
}): Mesh {
  const cap = new Mesh(
    new SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, params.thetaLength),
    params.material,
  )
  cap.scale.set(...params.radii)
  cap.position.set(...params.position)
  cap.rotation.x = -params.backwardTiltRadians
  cap.castShadow = true
  return cap
}

function createHead(materials: OperatorMaterials): Group {
  const head = new Group()
  head.position.set(0, OPERATOR_BODY.neckAboveHipM, 0)
  head.add(
    // Cranium, cheeks and jaw
    createScaledSphere({
      radii: [0.079, 0.098, 0.092],
      material: materials.skin,
      position: [0, 0.142, 0.002],
    }),
    createScaledSphere({
      radii: [0.066, 0.06, 0.07],
      material: materials.skin,
      position: [0, 0.09, 0.02],
    }),
    createScaledSphere({
      radii: [0.03, 0.022, 0.03],
      material: materials.skin,
      position: [0, 0.058, 0.05],
    }),
    // Hair: a full cap over the crown, a fuller back, and short sides above the ears
    createHairCap({
      radii: [0.086, 0.104, 0.099],
      position: [0, 0.146, -0.004],
      thetaLength: Math.PI * 0.56,
      backwardTiltRadians: 0.42,
      material: materials.hair,
    }),
    createScaledSphere({
      radii: [0.074, 0.072, 0.05],
      material: materials.hair,
      position: [0, 0.135, -0.052],
    }),
    // Nose and mouth
    createScaledSphere({
      radii: [0.0105, 0.019, 0.016],
      material: materials.skin,
      position: [0, 0.126, 0.091],
    }),
    createScaledSphere({
      radii: [0.017, 0.0032, 0.004],
      material: materials.lips,
      position: [0, 0.093, 0.085],
    }),
  )
  for (const sideX of [-1, 1]) {
    head.add(
      createScaledSphere({
        radii: [0.011, 0.022, 0.015],
        material: materials.skin,
        position: [sideX * 0.08, 0.133, 0.004],
      }),
      createScaledSphere({
        radii: [0.012, 0.035, 0.03],
        material: materials.hair,
        position: [sideX * 0.074, 0.165, -0.012],
      }),
      createSphereMesh({
        radiusM: 0.0098,
        material: materials.eyeWhite,
        position: [sideX * 0.03, 0.146, 0.08],
      }),
      createSphereMesh({
        radiusM: 0.0052,
        material: materials.iris,
        position: [sideX * 0.03, 0.146, 0.0885],
      }),
      createScaledSphere({
        radii: [0.015, 0.0032, 0.005],
        material: materials.hair,
        position: [sideX * 0.031, 0.165, 0.086],
      }),
    )
  }
  return head
}

function createTorso(materials: OperatorMaterials): {
  torso: Group
  head: Group
} {
  const torso = new Group()
  torso.add(
    createLathe({
      profile: [
        [0, -0.12],
        [0.11, -0.115],
        [0.155, -0.07],
        [0.162, 0.0],
        [0.152, 0.09],
      ],
      material: materials.pants,
      depthScale: 0.66,
    }),
    // Chest widens into the shoulders so the arms join the body.
    createLathe({
      profile: [
        [0.15, 0.07],
        [0.143, 0.15],
        [0.143, 0.22],
        [0.158, 0.31],
        [0.182, 0.4],
        [0.198, 0.46],
        [0.196, 0.5],
        [0.165, 0.54],
        [0.09, 0.572],
        [0, 0.578],
      ],
      material: materials.shirt,
      depthScale: 0.6,
    }),
  )
  // Shoulder line: trapezius and deltoids, from one shoulder joint to the other.
  const shoulderLine = new Mesh(
    new CapsuleGeometry(0.056, 2 * OPERATOR_BODY.shoulderHalfWidthM, 8, 18),
    materials.shirt,
  )
  shoulderLine.rotation.z = Math.PI / 2
  shoulderLine.scale.set(1, 1, 0.78)
  shoulderLine.position.set(0, OPERATOR_BODY.shoulderAboveHipM - 0.012, -0.006)
  shoulderLine.castShadow = true
  const belt = createCylinderMesh({
    radiusTopM: 0.156,
    radiusBottomM: 0.157,
    heightM: 0.03,
    material: materials.belt,
    position: [0, 0.075, 0],
    radialSegments: 28,
  })
  belt.scale.z = 0.66
  torso.add(
    shoulderLine,
    belt,
    createCylinderMesh({
      radiusTopM: 0.047,
      radiusBottomM: 0.056,
      heightM: 0.13,
      material: materials.skin,
      position: [0, 0.6, 0.006],
      radialSegments: 16,
    }),
  )
  const head = createHead(materials)
  torso.add(head)
  return { torso, head }
}

function createLeg(
  params: { side: BodySide; operatorGroup: Group },
  materials: OperatorMaterials,
): OperatorLeg {
  const foot = new Mesh(new CapsuleGeometry(0.04, 0.16, 6, 14), materials.shoe)
  foot.geometry.rotateX(Math.PI / 2)
  foot.scale.set(1, 0.62, 1)
  foot.castShadow = true
  const leg: OperatorLeg = {
    side: params.side,
    hip: createSphereMesh({ radiusM: 0.072, material: materials.pants }),
    thigh: createLimbSegment({
      radiusTopM: 0.068,
      radiusBottomM: 0.05,
      material: materials.pants,
    }),
    knee: createSphereMesh({ radiusM: 0.05, material: materials.pants }),
    shin: createLimbSegment({
      radiusTopM: 0.048,
      radiusBottomM: 0.036,
      material: materials.pants,
    }),
    foot,
  }
  params.operatorGroup.add(leg.hip, leg.thigh, leg.knee, leg.shin, leg.foot)
  return leg
}

function createFinger(
  params: { x: number; proximalM: number; distalM: number },
  skin: Material,
): OperatorFinger {
  const proximal = new Group()
  proximal.position.set(params.x, -0.09, 0.002)
  proximal.add(
    createCylinderMesh({
      radiusTopM: 0.0088,
      radiusBottomM: 0.008,
      heightM: params.proximalM,
      material: skin,
      position: [0, -params.proximalM / 2, 0],
      radialSegments: 10,
    }),
    createSphereMesh({
      radiusM: 0.0083,
      material: skin,
      position: [0, -params.proximalM, 0],
      widthSegments: 10,
      heightSegments: 8,
    }),
  )
  const distal = new Group()
  distal.position.y = -params.proximalM
  distal.add(
    createCylinderMesh({
      radiusTopM: 0.0078,
      radiusBottomM: 0.0068,
      heightM: params.distalM,
      material: skin,
      position: [0, -params.distalM / 2, 0],
      radialSegments: 10,
    }),
    createSphereMesh({
      radiusM: 0.0068,
      material: skin,
      position: [0, -params.distalM, 0],
      widthSegments: 10,
      heightSegments: 8,
    }),
  )
  proximal.add(distal)
  return { proximal, distal }
}

function createHand(
  params: { side: BodySide; operatorGroup: Group },
  materials: OperatorMaterials,
): OperatorHand {
  const { side, operatorGroup } = params
  const skin = materials.handSkin
  const hand = new Group()
  hand.add(
    createScaledSphere({
      radii: [0.04, 0.05, 0.014],
      material: skin,
      position: [0, -0.05, 0],
    }),
  )
  const fingers = FINGER_LAYOUT.map((layout) =>
    createFinger({ ...layout, x: layout.x * -side }, skin),
  )
  for (const finger of fingers) hand.add(finger.proximal)
  const thumb = new Group()
  thumb.position.set(side * 0.034, -0.03, 0.01)
  thumb.add(
    createCylinderMesh({
      radiusTopM: 0.0105,
      radiusBottomM: 0.009,
      heightM: 0.052,
      material: skin,
      position: [0, -0.026, 0],
      radialSegments: 10,
    }),
    createSphereMesh({
      radiusM: 0.009,
      material: skin,
      position: [0, -0.052, 0],
      widthSegments: 10,
      heightSegments: 8,
    }),
  )
  hand.add(thumb)

  const operatorHand: OperatorHand = {
    side,
    hand,
    fingers,
    thumb,
    shoulder: createSphereMesh({ radiusM: 0.051, material: materials.shirt }),
    upperArm: createLimbSegment({
      radiusTopM: 0.05,
      radiusBottomM: 0.036,
      material: materials.shirt,
    }),
    elbow: createSphereMesh({ radiusM: 0.031, material: skin }),
    forearm: createLimbSegment({
      radiusTopM: 0.031,
      radiusBottomM: 0.024,
      material: skin,
    }),
    wrist: createSphereMesh({ radiusM: 0.024, material: skin }),
    targetPosition: new Vector3(),
    trackTarget: null,
    isReaching: false,
    reachBlend: 0,
    fingerDirection: RELAXED_FINGER_DIRECTION.clone(),
    targetFingerDirection: RELAXED_FINGER_DIRECTION.clone(),
    fingerCurl: RELAXED_FINGER_CURL,
    targetFingerCurl: RELAXED_FINGER_CURL,
    heldObject: null,
  }
  operatorGroup.add(
    hand,
    operatorHand.shoulder,
    operatorHand.upperArm,
    operatorHand.elbow,
    operatorHand.forearm,
    operatorHand.wrist,
  )
  return operatorHand
}

/** Build the operator rig. Call `updateOperatorPose` to pose it each frame. */
export function createOperator(): Operator {
  const group = new Group()
  group.name = "operator"
  const materials: OperatorMaterials = {
    shirt: createStandardMaterial({ color: 0x46709a, roughness: 0.9 }),
    pants: createStandardMaterial({ color: 0x39424f, roughness: 0.92 }),
    skin: createStandardMaterial({ color: 0xc89a7a, roughness: 0.68 }),
    handSkin: createStandardMaterial({ color: 0xc89a7a, roughness: 0.68 }),
    shoe: createStandardMaterial({ color: 0x2b2b2d, roughness: 0.55 }),
    hair: createStandardMaterial({ color: 0x3b2b20, roughness: 0.95 }),
    belt: createStandardMaterial({ color: 0x3a2a20, roughness: 0.6 }),
    lips: createStandardMaterial({ color: 0xa8625a, roughness: 0.6 }),
    eyeWhite: createStandardMaterial({ color: 0xf2efe9, roughness: 0.3 }),
    iris: createStandardMaterial({ color: 0x2f241c, roughness: 0.3 }),
  }
  const { torso, head } = createTorso(materials)
  group.add(torso)
  const legs = [
    createLeg({ side: 1, operatorGroup: group }, materials),
    createLeg({ side: -1, operatorGroup: group }, materials),
  ]
  const leftHand = createHand({ side: 1, operatorGroup: group }, materials)
  const rightHand = createHand({ side: -1, operatorGroup: group }, materials)
  return {
    group,
    torso,
    head,
    legs,
    leftHand,
    rightHand,
    hands: [leftHand, rightHand],
    materials: Object.values(materials).filter(
      (material) => material !== materials.handSkin,
    ),
    handMaterials: [materials.handSkin],
    position: new Vector3(),
    ccwYawRadians: 0,
    walkSpeedMps: 0,
    gaitPhaseRadians: 0,
    gaitBlend: 0,
    hipBendRadians: 0,
  }
}

/** Put the operator back at a pose with empty, relaxed hands. Held objects stay where they are. */
export function resetOperator(params: {
  operator: Operator
  x: number
  z: number
  ccwYawRadians: number
}): void {
  const { operator } = params
  operator.position.set(params.x, 0, params.z)
  operator.ccwYawRadians = params.ccwYawRadians
  operator.walkSpeedMps = 0
  operator.gaitBlend = 0
  operator.hipBendRadians = 0
  for (const hand of operator.hands) {
    hand.trackTarget = null
    hand.isReaching = false
    hand.reachBlend = 0
    hand.heldObject = null
    hand.fingerCurl = RELAXED_FINGER_CURL
    hand.targetFingerCurl = RELAXED_FINGER_CURL
    hand.fingerDirection.copy(RELAXED_FINGER_DIRECTION)
    hand.targetFingerDirection.copy(RELAXED_FINGER_DIRECTION)
    // Drop anything still parented to the hand from a previous run.
    for (const child of [...hand.hand.children]) {
      if (child.userData.isCarried) hand.hand.remove(child)
    }
  }
}
