import { createUsbCPlug } from "lib/models/plugs"
import { createStandardMaterial } from "lib/scene/primitives"
import { Group, Mesh, TorusGeometry } from "three"

/** LISEN 6.6 ft USB-C to USB-C cable (black), coiled flat and tied, ready to pack. Origin on its base. */
export const COILED_USB_CABLE = {
  outerRadiusM: 0.0223,
  heightM: 0.0095,
} as const

export function createCoiledUsbCable(): Group {
  const coil = new Group()
  const material = createStandardMaterial({ color: 0x1f2226, roughness: 0.6 })
  for (const [index, radiusM] of [0.017, 0.0195].entries()) {
    const loop = new Mesh(new TorusGeometry(radiusM, 0.0028, 8, 36), material)
    loop.rotation.x = Math.PI / 2
    loop.position.y = 0.0028 + index * 0.0035
    loop.castShadow = true
    coil.add(loop)
  }
  const tie = new Mesh(
    new TorusGeometry(0.0048, 0.0012, 6, 16),
    createStandardMaterial({ color: 0xff4fa3, roughness: 0.7 }),
  )
  tie.position.set(0.019, 0.0045, 0)
  coil.add(tie)
  for (const sideZ of [-0.006, 0.006]) {
    const plug = createUsbCPlug({})
    plug.group.rotation.set(Math.PI / 2, 0, -Math.PI / 2)
    plug.group.position.set(-0.017, 0.0085, sideZ)
    coil.add(plug.group)
  }
  return coil
}
