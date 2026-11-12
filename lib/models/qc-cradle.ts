import { Group } from "three"
import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"

/** Two V-blocks that hold a motor on its side for the spin test. Origin on the table. */
export const QC_CRADLE = { motorAxisHeightM: 0.031 } as const

export function createQcCradle(): Group {
  const cradle = new Group()
  const material = createStandardMaterial({ color: 0x4d5a66 })
  for (const x of [-0.012, 0.012]) {
    for (const z of [-0.016, 0.016]) {
      const block = createBoxMesh({
        size: [0.012, 0.016, 0.014],
        material,
        position: [x, 0.008, z],
      })
      block.rotation.x = z > 0 ? 0.6 : -0.6
      cradle.add(block)
    }
    cradle.add(
      createBoxMesh({
        size: [0.014, 0.006, 0.05],
        material,
        position: [x, 0.003, 0],
      }),
    )
  }
  return cradle
}
