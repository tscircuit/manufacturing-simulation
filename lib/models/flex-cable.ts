import {
  CatmullRomCurve3,
  type Material,
  Mesh,
  type Object3D,
  TubeGeometry,
  Vector3,
} from "three"
import { createStandardMaterial } from "lib/scene/primitives"

/**
 * A cable drawn between two anchors. Each anchor's +Y is the direction the
 * wire leaves it. Call `updateFlexCable` after anything moves; the tube is
 * rebuilt in world space, so add `wire` to an object with an identity
 * transform.
 */
export interface FlexCable {
  wire: Mesh
  startAnchor: Object3D
  endAnchor: Object3D
  /** Extra offset of the cable's middle, in `slackFrame` (or world, if null). */
  slackOffset: Vector3
  slackFrame: Object3D | null
  /** The cable never drops below this height (a table top). */
  minYM: number
  radiusM: number
  /** How far the wire runs straight out of each anchor before curving. */
  leadLengthM: number
  /** Anchor positions, directions and slack at the last redraw. */
  lastPose: number[]
}

const TUBE_SEGMENTS = 40
const POSE_EPSILON = 1e-5
const RADIAL_SEGMENTS = 6

export function createFlexCable(params: {
  startAnchor: Object3D
  endAnchor: Object3D
  color: number
  radiusM: number
  minYM: number
  slackOffset: Vector3
  leadLengthM?: number
}): FlexCable {
  const material: Material = createStandardMaterial({
    color: params.color,
    roughness: 0.6,
  })
  const wire = new Mesh(undefined, material)
  wire.castShadow = true
  wire.frustumCulled = false
  return {
    wire,
    startAnchor: params.startAnchor,
    endAnchor: params.endAnchor,
    slackOffset: params.slackOffset,
    slackFrame: null,
    minYM: params.minYM,
    radiusM: params.radiusM,
    leadLengthM: params.leadLengthM ?? 0.03,
    lastPose: [],
  }
}

function getAnchorRay(anchor: Object3D): {
  position: Vector3
  direction: Vector3
} {
  anchor.updateWorldMatrix(true, false)
  const position = anchor.getWorldPosition(new Vector3())
  const direction = new Vector3(0, 1, 0).transformDirection(anchor.matrixWorld)
  return { position, direction }
}

/** Rebuild the wire if either end or the slack frame moved. */
export function updateFlexCable(cable: FlexCable): void {
  const start = getAnchorRay(cable.startAnchor)
  const end = getAnchorRay(cable.endAnchor)
  const slack = cable.slackOffset.clone()
  if (cable.slackFrame)
    slack
      .transformDirection(cable.slackFrame.matrixWorld)
      .multiplyScalar(cable.slackOffset.length())
  const pose = [
    start.position,
    end.position,
    start.direction,
    end.direction,
    slack,
  ].flatMap((vector) => vector.toArray())
  const hasMoved =
    pose.length !== cable.lastPose.length ||
    pose.some(
      (component, index) =>
        Math.abs(component - cable.lastPose[index]) > POSE_EPSILON,
    )
  if (!hasMoved) return
  cable.lastPose = pose

  const middle = start.position
    .clone()
    .add(end.position)
    .multiplyScalar(0.5)
    .add(slack)
  const controlPoints = [
    start.position,
    start.position.clone().addScaledVector(start.direction, cable.leadLengthM),
    middle,
    end.position.clone().addScaledVector(end.direction, cable.leadLengthM),
    end.position,
  ]
  const floorYM = cable.minYM + cable.radiusM
  for (const point of controlPoints.slice(1, -1))
    point.y = Math.max(point.y, floorYM)
  const curve = new CatmullRomCurve3(controlPoints, false, "centripetal")
  cable.wire.geometry.dispose()
  cable.wire.geometry = new TubeGeometry(
    curve,
    TUBE_SEGMENTS,
    cable.radiusM,
    RADIAL_SEGMENTS,
    false,
  )
}
