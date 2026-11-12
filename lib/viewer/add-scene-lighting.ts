import { DirectionalLight, HemisphereLight, type Scene } from "three"
import { FLOOR_PLAN } from "lib/layout/floor-plan"

/** Sky fill, a shadow-casting key light over the room, and a soft rim light. */
export function addSceneLighting(scene: Scene): void {
  const centerX = FLOOR_PLAN.widthM / 2
  const centerZ = FLOOR_PLAN.eastLengthM / 2
  scene.add(new HemisphereLight(0xffffff, 0x8090a0, 0.75 * Math.PI))

  const keyLight = new DirectionalLight(0xffffff, 0.75 * Math.PI)
  keyLight.position.set(centerX - 5, 10, centerZ - 3)
  keyLight.target.position.set(centerX, 0, centerZ)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.set(2048, 2048)
  Object.assign(keyLight.shadow.camera, {
    left: -9,
    right: 9,
    top: 9,
    bottom: -9,
    near: 1,
    far: 30,
  })
  keyLight.shadow.bias = -0.0006
  scene.add(keyLight, keyLight.target)

  const rimLight = new DirectionalLight(0xffffff, 0.25 * Math.PI)
  rimLight.position.set(FLOOR_PLAN.widthM + 4, 5, centerZ + 4)
  scene.add(rimLight)
}
