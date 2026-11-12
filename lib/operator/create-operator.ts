import {
  Group,
  type Material,
  Mesh,
  type Object3D,
  SphereGeometry,
  Vector3,
} from "three"
import {
  OPERATOR_BODY,
  RELAXED_FINGER_CURL,
  RELAXED_FINGER_DIRECTION,
} from "lib/operator/operator-body"
import {
  createBoxMesh,
  createCylinderMesh,
  createSphereMesh,
  createStandardMaterial,
} from "lib/scene/primitives"
import { BLACK_PLASTIC_MATERIAL } from "lib/scene/shared-materials"

/** +1 is the operator's left (local +X), -1 is the right. */
export type BodySide = 1 | -1

export interface OperatorHand {
  side: BodySide
  hand: Group
  fingerBase: Group
  fingerTip: Group
  thumb: Group
  upperArm: Mesh
  forearm: Mesh
  elbow: Mesh
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
  thigh: Mesh
  shin: Mesh
  knee: Mesh
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
  shoe: Material
  hair: Material
}

function createLimbSegment(params: {
  radiusTopM: number
  radiusBottomM: number
  material: Material
}): Mesh {
  // Unit height; scaled along Y to the segment length each frame.
  return createCylinderMesh({ ...params, heightM: 1, radialSegments: 14 })
}

function createTorso(materials: OperatorMaterials): {
  torso: Group
  head: Group
} {
  const torso = new Group()
  torso.add(
    createBoxMesh({
      size: [0.33, 0.2, 0.19],
      material: materials.pants,
      position: [0, 0.03, 0],
    }),
  )
  const chest = createCylinderMesh({
    radiusTopM: 0.195,
    radiusBottomM: 0.16,
    heightM: 0.42,
    material: materials.shirt,
    position: [0, 0.325, 0],
    radialSegments: 18,
  })
  chest.scale.z = 0.6
  const shoulderYoke = createCylinderMesh({
    radiusTopM: 0.07,
    radiusBottomM: 0.07,
    heightM: 0.43,
    material: materials.shirt,
    position: [0, OPERATOR_BODY.shoulderAboveHipM, 0],
    radialSegments: 12,
  })
  shoulderYoke.rotation.z = Math.PI / 2
  shoulderYoke.scale.z = 0.9
  torso.add(
    chest,
    shoulderYoke,
    createCylinderMesh({
      radiusTopM: 0.05,
      radiusBottomM: 0.055,
      heightM: 0.09,
      material: materials.skin,
      position: [0, 0.6, 0],
      radialSegments: 12,
    }),
  )

  const head = new Group()
  head.position.set(0, OPERATOR_BODY.neckAboveHipM, 0)
  torso.add(head)
  const skull = new Mesh(new SphereGeometry(1, 20, 16), materials.skin)
  skull.position.set(0, 0.125, 0.005)
  skull.scale.set(0.098, 0.125, 0.108)
  skull.castShadow = true
  const hair = new Mesh(
    new SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
    materials.hair,
  )
  hair.position.set(0, 0.131, -0.006)
  hair.scale.set(0.103, 0.124, 0.113)
  hair.castShadow = true
  head.add(
    skull,
    hair,
    createSphereMesh({
      radiusM: 0.011,
      material: BLACK_PLASTIC_MATERIAL,
      position: [0.036, 0.135, 0.098],
      widthSegments: 8,
      heightSegments: 8,
    }),
    createSphereMesh({
      radiusM: 0.011,
      material: BLACK_PLASTIC_MATERIAL,
      position: [-0.036, 0.135, 0.098],
      widthSegments: 8,
      heightSegments: 8,
    }),
    createBoxMesh({
      size: [0.02, 0.03, 0.02],
      material: materials.skin,
      position: [0, 0.11, 0.108],
    }),
  )
  return { torso, head }
}

function createLeg(
  params: { side: BodySide; operatorGroup: Group },
  materials: OperatorMaterials,
): OperatorLeg {
  const leg = {
    side: params.side,
    thigh: createLimbSegment({
      radiusTopM: 0.078,
      radiusBottomM: 0.058,
      material: materials.pants,
    }),
    shin: createLimbSegment({
      radiusTopM: 0.056,
      radiusBottomM: 0.042,
      material: materials.pants,
    }),
    knee: createSphereMesh({ radiusM: 0.058, material: materials.pants }),
    foot: createBoxMesh({ size: [0.1, 0.075, 0.28], material: materials.shoe }),
  }
  params.operatorGroup.add(leg.thigh, leg.shin, leg.knee, leg.foot)
  return leg
}

function createHand(
  params: { side: BodySide; operatorGroup: Group },
  materials: OperatorMaterials,
): OperatorHand {
  const { side, operatorGroup } = params
  const hand = new Group()
  hand.add(
    createBoxMesh({
      size: [0.085, 0.095, 0.03],
      material: materials.skin,
      position: [0, -0.048, 0],
    }),
  )
  const fingerBase = new Group()
  fingerBase.position.set(0, -0.095, 0)
  fingerBase.add(
    createBoxMesh({
      size: [0.08, 0.045, 0.022],
      material: materials.skin,
      position: [0, -0.0225, 0],
    }),
  )
  const fingerTip = new Group()
  fingerTip.position.set(0, -0.045, 0)
  fingerTip.add(
    createBoxMesh({
      size: [0.078, 0.04, 0.02],
      material: materials.skin,
      position: [0, -0.02, 0],
    }),
  )
  fingerBase.add(fingerTip)
  const thumb = new Group()
  thumb.position.set(side * 0.045, -0.035, 0.012)
  thumb.add(
    createBoxMesh({
      size: [0.022, 0.065, 0.022],
      material: materials.skin,
      position: [0, -0.03, 0],
    }),
  )
  hand.add(fingerBase, thumb)

  const operatorHand: OperatorHand = {
    side,
    hand,
    fingerBase,
    fingerTip,
    thumb,
    upperArm: createLimbSegment({
      radiusTopM: 0.052,
      radiusBottomM: 0.043,
      material: materials.shirt,
    }),
    forearm: createLimbSegment({
      radiusTopM: 0.042,
      radiusBottomM: 0.032,
      material: materials.skin,
    }),
    elbow: createSphereMesh({ radiusM: 0.044, material: materials.shirt }),
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
    operatorHand.upperArm,
    operatorHand.forearm,
    operatorHand.elbow,
  )
  return operatorHand
}

/** Build the operator rig. Call `updateOperatorPose` to pose it each frame. */
export function createOperator(): Operator {
  const group = new Group()
  group.name = "operator"
  const materials: OperatorMaterials = {
    shirt: createStandardMaterial({ color: 0x2d5f8f, roughness: 0.85 }),
    pants: createStandardMaterial({ color: 0x2a2f37, roughness: 0.9 }),
    skin: createStandardMaterial({ color: 0xc79a78, roughness: 0.75 }),
    shoe: createStandardMaterial({ color: 0x17191c }),
    hair: createStandardMaterial({ color: 0x2b221b, roughness: 0.95 }),
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
