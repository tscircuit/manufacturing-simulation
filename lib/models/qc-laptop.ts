import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D } from "three"

export type QcDisplayState = "idle" | "testing" | "pass"

/** Screen colours the viewer can replace with a rendered dashboard. */
export const QC_DISPLAY_COLORS: Record<QcDisplayState, number> = {
  idle: 0x1b2633,
  testing: 0x1d4f91,
  pass: 0x1d7f4f,
}

/** Laptop running the motor-bench QC page. Origin on its base, screen at the back (-Z). */
export interface QcLaptop {
  group: Group
  display: Mesh<BoxGeometry, MeshBasicMaterial>
  displayState: QcDisplayState
  /** Where the operator taps to start a test. */
  trackpad: Object3D
  /** USB-C port on the left side, +Y pointing out. */
  usbPortAnchor: Object3D
}

export function createQcLaptop(): QcLaptop {
  const group = new Group()
  const shell = createStandardMaterial({
    color: 0x9aa3ad,
    metalness: 0.5,
    roughness: 0.4,
  })
  group.add(
    createBoxMesh({
      size: [0.3, 0.016, 0.21],
      material: shell,
      position: [0, 0.008, 0],
    }),
    createBoxMesh({
      size: [0.26, 0.001, 0.1],
      material: createStandardMaterial({ color: 0x2b3036 }),
      position: [0, 0.0165, -0.035],
    }),
    createBoxMesh({
      size: [0.1, 0.0008, 0.06],
      material: createStandardMaterial({ color: 0x8b939c }),
      position: [0, 0.0164, 0.065],
    }),
  )
  const lid = new Group()
  lid.position.set(0, 0.016, -0.105)
  lid.rotation.x = -0.32
  lid.add(
    createBoxMesh({
      size: [0.3, 0.2, 0.008],
      material: shell,
      position: [0, 0.1, -0.004],
    }),
  )
  const display = new Mesh(
    new BoxGeometry(0.27, 0.17, 0.001),
    new MeshBasicMaterial({ color: QC_DISPLAY_COLORS.idle }),
  )
  display.position.set(0, 0.1, 0.0006)
  lid.add(display)
  group.add(lid)

  const trackpad = new Object3D()
  trackpad.position.set(0, 0.018, 0.065)
  const usbPortAnchor = new Object3D()
  usbPortAnchor.position.set(-0.152, 0.008, -0.02)
  usbPortAnchor.rotation.z = Math.PI / 2
  group.add(trackpad, usbPortAnchor)
  return { group, display, displayState: "idle", trackpad, usbPortAnchor }
}
