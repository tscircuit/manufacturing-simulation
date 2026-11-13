import { CARTON_LABEL } from "lib/models/carton-label"
import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { Group, Vector3 } from "three"

const WIDTH_M = 0.18
const DEPTH_M = 0.2
const SLOT_HEIGHT_M = 0.044
const SLOT_GAP_M = 0.004
const TRAY_DEPTH_M = 0.105

/** A 4-inch thermal roll printer. Its label feeds through the slot toward +Z. */
export function createThermalLabelPrinter() {
  const group = new Group()
  const frontM = DEPTH_M / 2
  const body = createStandardMaterial({ color: 0x282e35 })
  const lid = createStandardMaterial({ color: 0x3c4650, roughness: 0.55 })
  const tray = createStandardMaterial({ color: 0x171c22 })
  group.add(
    createBoxMesh({
      size: [WIDTH_M, SLOT_HEIGHT_M, DEPTH_M],
      material: body,
      position: [0, SLOT_HEIGHT_M / 2, 0],
    }),
    createBoxMesh({
      size: [WIDTH_M, 0.07, DEPTH_M],
      material: lid,
      position: [0, SLOT_HEIGHT_M + SLOT_GAP_M + 0.035, 0],
    }),
    createBoxMesh({
      size: [0.126, SLOT_GAP_M, 0.01],
      material: tray,
      position: [0, SLOT_HEIGHT_M + SLOT_GAP_M / 2, frontM - 0.025],
    }),
    createBoxMesh({
      size: [0.122, 0.005, TRAY_DEPTH_M],
      material: tray,
      position: [0, SLOT_HEIGHT_M - 0.0025, frontM + TRAY_DEPTH_M / 2],
    }),
    createBoxMesh({
      size: [0.013, 0.002, 0.009],
      material: createStandardMaterial({ color: 0x5cdd9e }),
      position: [0.06, SLOT_HEIGHT_M + SLOT_GAP_M + 0.07, 0.066],
    }),
  )
  return {
    group,
    feedStart: new Vector3(0, SLOT_HEIGHT_M, frontM - CARTON_LABEL.lengthM / 2),
    feedEnd: new Vector3(
      0,
      SLOT_HEIGHT_M,
      frontM + CARTON_LABEL.lengthM / 2 + 0.004,
    ),
  }
}
