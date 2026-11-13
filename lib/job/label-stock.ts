import type { LabelSheet } from "lib/models/label-sheet"
import type { ManufacturingWorld } from "lib/world/create-world"
import type { Group } from "three"

/** Labels left on the sheets at pack-out. */
export function countLabelsAtPackOut(world: ManufacturingWorld): number {
  return world.labelSheets.reduce((sum, sheet) => sum + sheet.labels.length, 0)
}

/**
 * The next label to peel, from the top sheet that still has labels. Empty
 * backing sheets above it are thrown away (hidden) as they are reached.
 */
export function takeNextLabel(world: ManufacturingWorld): Group | null {
  return takeNextFromSheets(world.labelSheets)
}

/** The next label from a stack of sheets, top sheet first; empty sheets are thrown away. */
export function takeNextFromSheets(sheets: LabelSheet[]): Group | null {
  while (sheets.length > 0) {
    const topSheet = sheets[0]
    const label = topSheet.labels.shift()
    if (label) return label
    topSheet.group.visible = false
    sheets.shift()
  }
  return null
}

/** Labels left on a stack of sheets. */
export function countLabelsOnSheets(sheets: LabelSheet[]): number {
  return sheets.reduce((sum, sheet) => sum + sheet.labels.length, 0)
}
