import { createJstPlug } from "lib/models/plugs"
import { createStandardMaterial } from "lib/scene/primitives"
import { Group, Mesh, TorusGeometry } from "three"

/** A spare pre-crimped JST-PH 2.0 motor cable (150 mm): 6-pin at the motor, PHR-4 at the controller. Looped and lying flat; origin on its base. */
export function createCoiledJstCable(): Group {
  const coil = new Group()
  const loop = new Mesh(
    new TorusGeometry(0.022, 0.0013, 6, 32),
    createStandardMaterial({ color: 0x1f2226, roughness: 0.6 }),
  )
  loop.rotation.x = Math.PI / 2
  loop.position.y = 0.0013
  loop.castShadow = true
  coil.add(loop)
  for (const [sideX, pinCount] of [
    [-0.009, 6],
    [0.008, 4],
  ]) {
    const plug = createJstPlug({ pinCount })
    plug.group.rotation.set(Math.PI / 2, 0, 0)
    plug.group.position.set(sideX, 0.0023, 0.022)
    coil.add(plug.group)
  }
  return coil
}
