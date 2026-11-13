import type { TableId } from "lib/layout/station-layout"
import type { SimContext } from "lib/simulation/sim-context"
import type { Object3D } from "three"

/** A rack, tote or carton: slots, and which unit sits in each. */
export interface SlottedContainer {
  group: Object3D
  slots: Object3D[]
  occupants: Array<number | null>
}

/** Reserve the first free slot for a unit and return its index. */
export function reserveSlot(params: {
  container: SlottedContainer
  unitIndex: number
}): number {
  const slotIndex = params.container.occupants.indexOf(null)
  if (slotIndex === -1) throw new Error("Container is full")
  params.container.occupants[slotIndex] = params.unitIndex
  return slotIndex
}

export function releaseSlot(params: {
  container: SlottedContainer
  unitIndex: number
}): void {
  const slotIndex = params.container.occupants.indexOf(params.unitIndex)
  if (slotIndex !== -1) params.container.occupants[slotIndex] = null
}

/** Units in a container, in slot order. */
export function getOccupants(container: {
  occupants: Array<number | null>
}): number[] {
  return container.occupants.filter(
    (unitIndex): unitIndex is number => unitIndex !== null,
  )
}

export function hasFreeSlot(container: {
  occupants: Array<number | null>
}): boolean {
  return container.occupants.includes(null)
}

/** The bench a container is sitting on, or null while it is carried. */
export function getBenchOf(
  params: { object: Object3D },
  ctx: SimContext,
): TableId | null {
  const { tables } = ctx.world
  for (const tableId of Object.keys(tables) as TableId[]) {
    if (params.object.parent === tables[tableId]) return tableId
  }
  return null
}
