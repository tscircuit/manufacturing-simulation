import {
  createBoxMesh,
  createCylinderMesh,
  createStandardMaterial,
  type Vec3Tuple,
} from "lib/scene/primitives"
import {
  CanvasTexture,
  type Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from "three"

export const paint = (color: number) => createStandardMaterial({ color })

export function box(
  parent: Group,
  material: Material,
  size: Vec3Tuple,
  at: Vec3Tuple,
) {
  const mesh = createBoxMesh({ material, size, position: at })
  parent.add(mesh)
  return mesh
}

export function rod(
  parent: Group,
  material: Material,
  from: Vec3Tuple,
  to: Vec3Tuple,
  radius: number,
  segments = 8,
) {
  const a = new Vector3(...from)
  const b = new Vector3(...to)
  const delta = b.clone().sub(a)
  const mesh = createCylinderMesh({
    material,
    radiusTopM: radius,
    radiusBottomM: radius,
    heightM: delta.length(),
    radialSegments: segments,
  })
  mesh.position.copy(a.addScaledVector(delta, 0.5))
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize())
  parent.add(mesh)
  return mesh
}

export function sign(
  parent: Group,
  label: string,
  width: number,
  height: number,
  at: Vec3Tuple,
  options: { color?: string; background?: string; yaw?: number } = {},
) {
  const canvas = document.createElement("canvas")
  canvas.width = 768
  canvas.height = Math.max(48, Math.round((768 * height) / width))
  const ctx = canvas.getContext("2d")!
  if (options.background) {
    ctx.fillStyle = options.background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.fillStyle = options.color ?? "#fff8df"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.font = "bold " + canvas.height * 0.69 + "px Arial, sans-serif"
  ctx.fillText(
    label,
    canvas.width / 2,
    canvas.height * 0.53,
    canvas.width * 0.94,
  )
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const face = new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  )
  face.position.set(...at)
  face.rotation.y = options.yaw ?? 0
  parent.add(face)
  return face
}
