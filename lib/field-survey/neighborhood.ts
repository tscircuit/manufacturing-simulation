import { createCylinderMesh } from "lib/scene/primitives"
import { DodecahedronGeometry, Group, Mesh, type Material } from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { box, paint, rod, sign } from "./shapes"

export function createNeighborhood() {
  const world = new Group()
  const road = paint(0x526366)
  const sidewalk = paint(0xcbc8b5)
  const stone = paint(0xdfd9c4)
  const seam = paint(0xa7a998)
  const white = paint(0xe1dbc2)
  const dark = paint(0x374b4b)
  const glass = paint(0x638488)
  const mullion = paint(0xd8cbb1)
  const brick = paint(0xb5765a)
  const brickShadow = paint(0xa56c54)
  const lawn = paint(0x91a76d)
  const grass = paint(0x7e985e)
  const timber = paint(0x8c694a)
  const canopies = [paint(0x608a6b), paint(0x719875), paint(0x87a776)]
  const teal = paint(0x275b53)
  box(world, sidewalk, [134, 0.16, 106], [0, -0.115, -1])
  box(world, road, [123, 0.03, 5.1], [0, -0.02, -3.28])
  for (const x of [20.65, 0, -10.6]) {
    box(world, road, [4.75, 0.035, 86], [x, -0.017, 0])
    for (const z of [-10.3, 6, 13.5, 21.5])
      box(world, white, [0.075, 0.006, 2.3], [x, 0.005, z])
    for (let stripe = -2; stripe <= 2; stripe++)
      box(world, white, [0.46, 0.008, 1.2], [x + stripe * 0.87, 0.009, 0])
  }
  for (let stripe = -2; stripe <= 2; stripe++)
    box(
      world,
      white,
      [1.2, 0.008, 0.48],
      [-13.53, 0.009, -3.27 + stripe * 0.92],
    )
  for (let x = -48; x < 46; x += 5) {
    if ([20.65, 0, -10.6].every((street) => Math.abs(x - street) > 3.2))
      box(world, white, [2.1, 0.008, 0.075], [x, 0.006, -3.27])
  }
  for (const [x, width] of [
    [-31, 35],
    [-5.3, 5.65],
    [10.2, 15.5],
    [37.5, 28],
  ]) {
    for (const z of [-5.95, -0.61]) {
      box(world, stone, [width, 0.033, 0.17], [x, -0.012, z])
      for (let dx = -width / 2 + 1; dx < width / 2; dx += 2.2) {
        box(
          world,
          seam,
          [0.013, 0.005, 1.35],
          [x + dx, -0.032, z < -3 ? z - 0.73 : z + 0.73],
        )
      }
    }
  }
  box(world, lawn, [32, 0.06, 27], [-27.5, -0.022, -20])
  box(world, sidewalk, [1.58, 0.039, 17], [-13.53, -0.001, -14.65])
  box(world, sidewalk, [11, 0.04, 1.35], [-18.43, 0, -8])
  for (let i = 0; i < 45; i++) {
    const x = -14.7 - ((i * 2.73) % 26)
    const z = -9.1 - ((i * 1.91) % 20)
    box(
      world,
      grass,
      [0.19 + (i % 3) * 0.08, 0.005, 0.04],
      [x, 0.014, z],
    ).rotation.y = i * 0.76
  }

  // A schematic loading entrance and industrial blocks along the route.
  box(world, brick, [9.4, 6, 14], [10.2, 2.98, 9.72])
  for (let row = 0; row < 24; row++) {
    const y = row * 0.235 + 0.09
    box(world, brickShadow, [0.013, 0.015, 13.97], [14.906, y, 9.72])
    for (let j = 0; j < 7; j++) {
      const z = 3.4 + j * 1.88 + (row % 2) * 0.75
      box(world, brickShadow, [0.012, 0.19, 0.018], [14.91, y + 0.105, z])
    }
  }
  box(world, stone, [0.17, 0.3, 14.1], [14.92, 0.15, 9.72])
  box(world, stone, [9.62, 0.18, 14.2], [10.2, 6.01, 9.72])
  box(world, dark, [0.15, 2.42, 1.56], [14.99, 1.21, 9.75])
  box(world, teal, [0.075, 2.27, 1.41], [15.08, 1.15, 9.75])
  box(world, glass, [0.012, 1.24, 0.99], [15.124, 1.49, 9.75])
  box(world, mullion, [0.085, 0.036, 0.54], [15.16, 1.02, 9.84])
  box(world, teal, [0.71, 0.095, 2.7], [15.19, 2.56, 9.75])
  sign(world, "tscircuit", 2.0, 0.46, [14.935, 3.07, 9.75], {
    yaw: Math.PI / 2,
    color: "#fff0d1",
  })
  sign(world, "2325 THIRD", 1.13, 0.19, [15.13, 2.18, 9.75], {
    yaw: Math.PI / 2,
    background: "#224842",
  })
  for (const z of [4.95, 7.0, 12.45, 14.43]) {
    for (const y of [1.72, 4.25]) {
      box(world, dark, [0.1, 1.66, 1.52], [14.96, y, z])
      box(world, glass, [0.06, 1.48, 1.35], [15.02, y, z])
      box(world, mullion, [0.083, 0.037, 1.41], [15.05, y, z])
      box(world, mullion, [0.083, 1.5, 0.035], [15.05, y, z])
      box(world, stone, [0.27, 0.066, 1.74], [15.03, y - 0.84, z])
    }
  }

  const buildings = [
    [-4.8, 6.1, 5.4, 7, 4.4, 0xa59a81],
    [-20.8, 8.8, 13.5, 12, 4.8, 0x9aaba4],
    [6.8, -12.9, 8, 12, 6.6, 0xb7aa92],
    [14.3, -11.5, 5.3, 9, 3.9, 0xba8668],
    [-4.8, -13.9, 5.4, 14, 5.0, 0xaca48d],
    [29.2, 8.8, 9, 13, 7.7, 0xb1a58e],
    [-32, 9.7, 8, 12, 6.5, 0xb0a394],
    [30, -12, 12, 10, 6, 0xad927a],
    [-20, -32.5, 20, 6, 7, 0xafa493],
    [-36, -26, 10, 11, 5.8, 0xb49c83],
  ]
  for (const [x, z, w, d, h, color] of buildings) {
    const face = paint(color)
    box(world, face, [w, h, d], [x, h / 2 - 0.03, z])
    box(world, stone, [w + 0.18, 0.17, d + 0.18], [x, h, z])
    for (const side of [-1, 1]) {
      for (let dx = -w / 2 + 0.9; dx < w / 2 - 0.45; dx += 1.7) {
        for (let y = 1.45; y < h - 0.45; y += 2.1) {
          box(
            world,
            dark,
            [1.18, 1.27, 0.08],
            [x + dx, y, z + side * (d / 2 + 0.025)],
          )
          box(
            world,
            glass,
            [1.04, 1.11, 0.045],
            [x + dx, y, z + side * (d / 2 + 0.083)],
          )
          box(
            world,
            mullion,
            [0.032, 1.1, 0.04],
            [x + dx, y, z + side * (d / 2 + 0.118)],
          )
        }
      }
    }
  }
  const tree = (x: number, z: number, h: number) => {
    rod(world, timber, [x, 0, z], [x, h * 0.7, z], 0.1)
    for (let i = 0; i < 3; i++) {
      const angle = i * 2.14 + x
      const dx = Math.cos(angle) * h * 0.15,
        dz = Math.sin(angle) * h * 0.13
      rod(world, timber, [x, h * 0.4, z], [x + dx, h * 0.71, z + dz], 0.055)
      const leaf = new Mesh(new DodecahedronGeometry(1, 0), canopies[i])
      leaf.scale.set(h * 0.3, h * (0.32 + i * 0.018), h * 0.26)
      leaf.position.set(x + dx, h * (0.68 + i * 0.036), z + dz)
      leaf.rotation.set(i * 0.16, x + i, 0.11 * i)
      leaf.castShadow = leaf.receiveShadow = true
      world.add(leaf)
    }
  }
  for (const [x, z, h] of [
    [16.4, 3.5, 3.3],
    [8, 0.85, 3.6],
    [-5, 0.85, 3.4],
    [-25, -15, 4.1],
    [-17, -18.5, 5.2],
    [-30, -10.2, 4.4],
    [-14.9, -24, 3.8],
    [-33, -20, 4.7],
    [-20, -24, 5],
    [-24, -27, 3.5],
    [10, -6.7, 4.3],
  ])
    tree(x, z, h)

  const bench = (x: number, z: number) => {
    for (const dx of [-0.55, 0.55])
      box(world, dark, [0.06, 0.42, 0.38], [x + dx, 0.21, z])
    for (const dz of [-0.14, 0, 0.14])
      box(world, timber, [1.55, 0.045, 0.12], [x, 0.44, z + dz])
    for (const dx of [-0.56, 0.56])
      box(world, dark, [0.045, 0.38, 0.045], [x + dx, 0.6, z - 0.18])
    for (const y of [0.61, 0.74])
      box(world, timber, [1.55, 0.091, 0.045], [x, y, z - 0.19])
  }
  bench(-23.6, -14.65)
  for (const x of [-21.6, -19.1])
    rod(world, timber, [x, 0, -15.9], [x, 1.82, -15.9], 0.055)
  box(world, teal, [2.96, 0.73, 0.11], [-20.35, 1.48, -15.9])
  sign(world, "ESPRIT PARK", 2.65, 0.36, [-20.35, 1.53, -15.83])
  for (const [x, z, street] of [
    [16.2, 1.25, "20TH ST"],
    [-2.85, 1.1, "TENNESSEE"],
    [-13.95, -6.36, "MINNESOTA"],
  ] as const) {
    rod(world, dark, [x, 0, z], [x, 2.57, z], 0.025)
    sign(world, street, 1.11, 0.2, [x, 2.42, z + 0.03], {
      background: "#315c50",
    })
  }
  for (const [x, z] of [
    [16.14, 13.1],
    [16.14, 6.3],
    [-14.45, -6.85],
  ]) {
    const bollard = createCylinderMesh({
      radiusTopM: 0.08,
      radiusBottomM: 0.09,
      heightM: 0.67,
      material: teal,
      position: [x, 0.335, z],
    })
    world.add(bollard)
    rod(world, stone, [x, 0.53, z], [x, 0.57, z], 0.088)
  }

  // The blocks, windows and street furniture are fixed. Batch them by material
  // so cart and camera playback on an integrated GPU takes few draw calls.
  const batches = new Map<Material, Mesh[]>()
  for (const child of world.children) {
    if (
      !(child instanceof Mesh) ||
      Array.isArray(child.material) ||
      child.material.transparent
    )
      continue
    const batch = batches.get(child.material) ?? []
    batch.push(child)
    batches.set(child.material, batch)
  }
  for (const [material, meshes] of batches) {
    const pieces = meshes.map((mesh) => {
      mesh.updateMatrix()
      const piece = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone()
      return piece.applyMatrix4(mesh.matrix)
    })
    const merged = new Mesh(mergeGeometries(pieces), material)
    merged.castShadow = merged.receiveShadow = true
    world.remove(...meshes)
    world.add(merged)
    for (const piece of pieces) piece.dispose()
    for (const mesh of meshes) mesh.geometry.dispose()
  }
  return world
}
