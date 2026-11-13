import { createSticker, type StickerKind } from "lib/models/sticker"
import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { METERS_PER_INCH } from "lib/units"
import { Group } from "three"

/**
 * AveneMark 2" x 4" label sheet: US Letter, 10 labels in 2 columns and 5
 * rows, each pre-cut 4" wide x 2" high with the artwork rotated so the applied
 * label is tall. Grid follows the provisional layout in
 * tscircuit/product-packaging (0.125" column gap, no row gap).
 */
export const LABEL_SHEET = {
  widthM: 8.5 * METERS_PER_INCH,
  lengthM: 11 * METERS_PER_INCH,
  backingThicknessM: 0.0001,
  columnPitchM: 4.125 * METERS_PER_INCH,
  rowPitchM: 2 * METERS_PER_INCH,
  columnCount: 2,
  rowCount: 5,
  labelYawRadians: -Math.PI / 2,
} as const
export const LABEL_SHEET_STACK_PITCH_M = 0.0006

const FNSKU_LABEL_SHEET = {
  ...LABEL_SHEET,
  columnPitchM: 2.75 * METERS_PER_INCH,
  rowPitchM: METERS_PER_INCH,
  columnCount: 3,
  rowCount: 10,
  labelYawRadians: 0,
} as const

export interface LabelSheet {
  group: Group
  /** Labels still on the backing, starting at the front of the sheet. */
  labels: Group[]
}

/** Origin under the centre of the sheet; the sheet's long side runs along Z. */
export function createLabelSheet(kind: StickerKind = "tscircuit"): LabelSheet {
  const group = new Group()
  const s = kind === "fnsku" ? FNSKU_LABEL_SHEET : LABEL_SHEET
  group.add(
    createBoxMesh({
      size: [s.widthM, s.backingThicknessM, s.lengthM],
      material: createStandardMaterial({ color: 0xece8de, roughness: 0.9 }),
      position: [0, s.backingThicknessM / 2, 0],
    }),
  )
  const labels: Group[] = []
  for (let row = s.rowCount - 1; row >= 0; row--) {
    for (let column = s.columnCount - 1; column >= 0; column--) {
      const label = createSticker(kind)
      label.position.set(
        (column - (s.columnCount - 1) / 2) * s.columnPitchM,
        s.backingThicknessM,
        (row - (s.rowCount - 1) / 2) * s.rowPitchM,
      )
      label.rotation.y = s.labelYawRadians
      group.add(label)
      labels.push(label)
    }
  }
  return { group, labels }
}
