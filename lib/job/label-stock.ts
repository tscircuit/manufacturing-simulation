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
  while (world.labelSheets.length > 0) {
    const topSheet = world.labelSheets[0]
    const label = topSheet.labels.shift()
    if (label) return label
    topSheet.group.visible = false
    world.labelSheets.shift()
  }
  return null
}
