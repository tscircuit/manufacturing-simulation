import {
  BoxGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  type Material,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape,
  type Side,
  SphereGeometry,
} from "three"

export type Vec3Tuple = [number, number, number]

export function createStandardMaterial(params: {
  color: number
  roughness?: number
  metalness?: number
  transparent?: boolean
  opacity?: number
  depthWrite?: boolean
  side?: Side
}): MeshStandardMaterial {
  return new MeshStandardMaterial({
    roughness: 0.7,
    metalness: 0,
    ...params,
  })
}

function placeMesh(params: { mesh: Mesh; position?: Vec3Tuple }): Mesh {
  const { mesh, position } = params
  if (position) mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function createBoxMesh(params: {
  size: Vec3Tuple
  material: Material
  position?: Vec3Tuple
}): Mesh {
  const mesh = new Mesh(new BoxGeometry(...params.size), params.material)
  return placeMesh({ mesh, position: params.position })
}

export function createCylinderMesh(params: {
  radiusTopM: number
  radiusBottomM: number
  heightM: number
  material: Material
  position?: Vec3Tuple
  radialSegments?: number
}): Mesh {
  const geometry = new CylinderGeometry(
    params.radiusTopM,
    params.radiusBottomM,
    params.heightM,
    params.radialSegments ?? 20,
  )
  return placeMesh({
    mesh: new Mesh(geometry, params.material),
    position: params.position,
  })
}

export function createSphereMesh(params: {
  radiusM: number
  material: Material
  position?: Vec3Tuple
  widthSegments?: number
  heightSegments?: number
}): Mesh {
  const geometry = new SphereGeometry(
    params.radiusM,
    params.widthSegments ?? 14,
    params.heightSegments ?? 10,
  )
  return placeMesh({
    mesh: new Mesh(geometry, params.material),
    position: params.position,
  })
}

/** Square of side `sizeM` with 45° corner cuts of `cornerClipM`, centred on the origin. */
export function createOctagonShape(params: {
  sizeM: number
  cornerClipM: number
}): Shape {
  const half = params.sizeM / 2
  const inner = half - params.cornerClipM
  const corners: Array<[number, number]> = [
    [-inner, -half],
    [inner, -half],
    [half, -inner],
    [half, inner],
    [inner, half],
    [-inner, half],
    [-half, inner],
    [-half, -inner],
  ]
  const shape = new Shape()
  shape.moveTo(...corners[0])
  for (const corner of corners.slice(1)) shape.lineTo(...corner)
  shape.closePath()
  return shape
}

export function createRectangleShape(params: {
  widthM: number
  depthM: number
}): Shape {
  const halfWidth = params.widthM / 2
  const halfDepth = params.depthM / 2
  const shape = new Shape()
  shape.moveTo(-halfWidth, -halfDepth)
  shape.lineTo(halfWidth, -halfDepth)
  shape.lineTo(halfWidth, halfDepth)
  shape.lineTo(-halfWidth, halfDepth)
  shape.closePath()
  return shape
}

/** A circular hole for `Shape.holes` (wound clockwise). */
export function createCircleHole(params: {
  x: number
  y: number
  radiusM: number
}): Path {
  const path = new Path()
  path.absarc(params.x, params.y, params.radiusM, 0, Math.PI * 2, true)
  return path
}

export function createDiscShape(radiusM: number): Shape {
  const shape = new Shape()
  shape.absarc(0, 0, radiusM, 0, Math.PI * 2, false)
  return shape
}

/**
 * Extrude a 2D shape upward. The shape's X maps to world X and its Y maps to
 * world -Z, so the part sits on its base at `baseYM`.
 */
export function createExtrudedMesh(params: {
  shape: Shape
  depthM: number
  material: Material
  baseYM?: number
}): Mesh {
  const geometry = new ExtrudeGeometry(params.shape, {
    depth: params.depthM,
    bevelEnabled: false,
    curveSegments: 20,
  })
  geometry.rotateX(-Math.PI / 2)
  return placeMesh({
    mesh: new Mesh(geometry, params.material),
    position: [0, params.baseYM ?? 0, 0],
  })
}
