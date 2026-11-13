import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import {
  BLACK_PLASTIC_MATERIAL,
  STEEL_MATERIAL,
} from "lib/scene/shared-materials"
import { Group, Object3D } from "three"

/** 45 W USB-C PD charger brick lying on its back. Origin on its base; the port faces +X. */
export const USB_CHARGER = {
  widthM: 0.04,
  depthM: 0.04,
  heightM: 0.026,
} as const

export interface UsbPowerSource {
  group: Group
  /** Where a USB-C cable leaves the device, +Y pointing out. */
  portAnchor: Object3D
}

export function createUsbCharger(): UsbPowerSource {
  const group = new Group()
  const { widthM, depthM, heightM } = USB_CHARGER
  group.add(
    createBoxMesh({
      size: [widthM, heightM, depthM],
      material: createStandardMaterial({ color: 0xf5f5f2, roughness: 0.4 }),
      position: [0, heightM / 2, 0],
    }),
    createBoxMesh({
      size: [0.0012, 0.009, 0.0028],
      material: STEEL_MATERIAL,
      position: [widthM / 2 + 0.0006, heightM / 2, 0],
    }),
    createBoxMesh({
      size: [0.002, 0.016, 0.006],
      material: STEEL_MATERIAL,
      position: [-widthM / 2 - 0.001, heightM * 0.3, -0.008],
    }),
    createBoxMesh({
      size: [0.002, 0.016, 0.006],
      material: STEEL_MATERIAL,
      position: [-widthM / 2 - 0.001, heightM * 0.3, 0.008],
    }),
  )
  const portAnchor = new Object3D()
  portAnchor.position.set(widthM / 2 + 0.002, heightM / 2, 0)
  portAnchor.rotation.z = -Math.PI / 2
  group.add(portAnchor)
  return { group, portAnchor }
}

const GAN_STATION = {
  widthM: 0.12,
  depthM: 0.075,
  heightM: 0.04,
  portCount: 10,
} as const

/** 10-port 1000 W USB-C GaN charging station that powers the QC bench. Ports face +Z. */
export function createGanChargingStation(): UsbPowerSource {
  const group = new Group()
  const { widthM, depthM, heightM, portCount } = GAN_STATION
  group.add(
    createBoxMesh({
      size: [widthM, heightM, depthM],
      material: BLACK_PLASTIC_MATERIAL,
      position: [0, heightM / 2, 0],
    }),
  )
  for (let port = 0; port < portCount; port++) {
    const column = port % 5
    const row = Math.floor(port / 5)
    group.add(
      createBoxMesh({
        size: [0.009, 0.0032, 0.001],
        material: STEEL_MATERIAL,
        position: [
          (column - 2) * 0.02,
          heightM * (0.35 + row * 0.35),
          depthM / 2 + 0.0005,
        ],
      }),
    )
  }
  const portAnchor = new Object3D()
  portAnchor.position.set(-0.04, heightM * 0.35, depthM / 2 + 0.001)
  portAnchor.rotation.x = Math.PI / 2
  group.add(portAnchor)
  return { group, portAnchor }
}
