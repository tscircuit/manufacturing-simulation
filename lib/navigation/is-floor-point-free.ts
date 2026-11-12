import { FLOOR_PLAN, getRoomLengthAtX } from "lib/layout/floor-plan"
import { FOLDING_TABLE, TABLE_PLACEMENTS } from "lib/layout/station-layout"

const WASHROOM_WALL_MARGIN_M = 0.05

/**
 * True when a circle of `clearanceM` centred on (x, z) fits on the floor
 * without touching a wall, the washroom or a table.
 */
export function isFloorPointFree(params: {
  x: number
  z: number
  clearanceM: number
}): boolean {
  const { x, z, clearanceM } = params
  if (x < clearanceM || x > FLOOR_PLAN.widthM - clearanceM) return false
  if (z < clearanceM) return false
  if (z > getRoomLengthAtX(x + clearanceM) - clearanceM) return false

  const { washroom } = FLOOR_PLAN
  const washroomMarginM = WASHROOM_WALL_MARGIN_M + clearanceM
  if (
    x > washroom.westWallXM - washroomMarginM &&
    z > washroom.northWallZM - washroomMarginM &&
    z < washroom.southWallZM + washroomMarginM
  ) {
    return false
  }

  for (const table of Object.values(TABLE_PLACEMENTS)) {
    const dx = x - table.centerXM
    const dz = z - table.centerZM
    const cos = Math.cos(table.ccwYawRadians)
    const sin = Math.sin(table.ccwYawRadians)
    const localX = dx * cos - dz * sin
    const localZ = dx * sin + dz * cos
    if (
      Math.abs(localX) < FOLDING_TABLE.lengthM / 2 + clearanceM &&
      Math.abs(localZ) < FOLDING_TABLE.depthM / 2 + clearanceM
    ) {
      return false
    }
  }
  return true
}
