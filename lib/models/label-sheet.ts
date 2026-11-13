import { createSticker, STICKER, type StickerArtwork } from "lib/models/sticker"
import { createBoxMesh, createStandardMaterial } from "lib/scene/primitives"
import { METERS_PER_INCH } from "lib/units"
import { Group } from "three"

/** A US Letter sheet of identical pre-cut labels. Labels sit with their length along X. */
export interface LabelSheetSpec {
  widthM: number
  lengthM: number
  backingThicknessM: number
  columnPitchM: number
  rowPitchM: number
  columnCount: number
  rowCount: number
  /** The label's own size: `labelWidthM` is its short side, `labelLengthM` its long side. */
  labelWidthM: number
  labelLengthM: number
  artwork: StickerArtwork
}

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
  labelWidthM: STICKER.widthM,
  labelLengthM: STICKER.lengthM,
  artwork: "kit_label",
} as const satisfies LabelSheetSpec

/**
 * The bare unit's bag sticker: 2" x 3" labels, 10 to a US Letter sheet
 * (2 columns x 5 rows), small enough for the front of a 4" x 6" ESD bag.
 */
export const BAG_LABEL_SHEET = {
  ...LABEL_SHEET,
  columnPitchM: 3.25 * METERS_PER_INCH,
  rowPitchM: 2.1 * METERS_PER_INCH,
  labelWidthM: 2 * METERS_PER_INCH,
  labelLengthM: 3 * METERS_PER_INCH,
  artwork: "bag_label",
} as const satisfies LabelSheetSpec

/**
 * Amazon FNSKU labels as printed from Seller Central: 1" x 2-5/8" address
 * labels, 30 to a US Letter sheet (3 columns x 10 rows).
 */
export const FNSKU_LABEL_SHEET = {
  ...LABEL_SHEET,
  columnPitchM: 2.75 * METERS_PER_INCH,
  rowPitchM: 1 * METERS_PER_INCH,
  columnCount: 3,
  rowCount: 10,
  labelWidthM: 1 * METERS_PER_INCH,
  labelLengthM: 2.625 * METERS_PER_INCH,
  artwork: "fnsku",
} as const satisfies LabelSheetSpec

export interface LabelSheet {
  group: Group
  /** Labels still on the backing, row by row from the back of the sheet. */
  labels: Group[]
}

/** Origin under the centre of the sheet; the sheet's long side runs along Z. */
export function createLabelSheet(
  spec: LabelSheetSpec = LABEL_SHEET,
): LabelSheet {
  const group = new Group()
  const s = spec
  group.add(
    createBoxMesh({
      size: [s.widthM, s.backingThicknessM, s.lengthM],
      material: createStandardMaterial({ color: 0xece8de, roughness: 0.9 }),
      position: [0, s.backingThicknessM / 2, 0],
    }),
  )
  const labels: Group[] = []
  for (let row = 0; row < s.rowCount; row++) {
    for (let column = 0; column < s.columnCount; column++) {
      const label = createSticker({
        widthM: s.labelWidthM,
        lengthM: s.labelLengthM,
        artwork: s.artwork,
      })
      label.position.set(
        (column - (s.columnCount - 1) / 2) * s.columnPitchM,
        s.backingThicknessM,
        (row - (s.rowCount - 1) / 2) * s.rowPitchM,
      )
      // Pre-cut with the label's long side along X.
      label.rotation.y = -Math.PI / 2
      group.add(label)
      labels.push(label)
    }
  }
  return { group, labels }
}
