import { Group, Mesh, TorusGeometry } from "three"
import { createJstPlug } from "lib/models/plugs"
import { createStandardMaterial } from "lib/scene/primitives"

/** A spare pre-crimped JST-PH 2.0 6-pin motor cable (150 mm), looped and lying flat. Origin on its base. */
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
  for (const sideX of [-0.008, 0.008]) {
    const plug = createJstPlug()
    plug.group.rotation.set(Math.PI / 2, 0, 0)
    plug.group.position.set(sideX, 0.0023, 0.022)
    coil.add(plug.group)
  }
  return coil
}
