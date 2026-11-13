import { createSticker, STICKER } from "lib/models/sticker"
import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { METERS_PER_INCH } from "lib/units"
import { Group } from "three"

/**
 * Simulated US Letter sheet with ten 2" x 3" labels. The labels are rotated
 * on the sheet, with two columns and five rows.
 */
export const LABEL_SHEET = {
  widthM: 8.5 * METERS_PER_INCH,
  lengthM: 11 * METERS_PER_INCH,
  backingThicknessM: 0.0001,
  columnPitchM: STICKER.lengthM + 0.125 * METERS_PER_INCH,
  rowPitchM: STICKER.widthM,
  columnCount: 2,
  rowCount: 5,
} as const
export const LABEL_SHEET_STACK_PITCH_M = 0.0006

export interface LabelSheet {
  group: Group
  /** Labels still on the backing, starting at the front of the sheet. */
  labels: Group[]
}

/** Origin under the centre of the sheet; the sheet's long side runs along Z. */
export function createLabelSheet(): LabelSheet {
  const group = new Group()
  const s = LABEL_SHEET
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
      const label = createSticker()
      label.position.set(
        (column - (s.columnCount - 1) / 2) * s.columnPitchM,
        s.backingThicknessM,
        (row - (s.rowCount - 1) / 2) * s.rowPitchM,
      )
      label.rotation.y = -Math.PI / 2
      group.add(label)
      labels.push(label)
    }
  }
  return { group, labels }
}
