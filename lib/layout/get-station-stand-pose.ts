import {
  FOLDING_TABLE,
  type Station,
  TABLE_PLACEMENTS,
} from "lib/layout/station-layout"

export interface StandPose {
  x: number
  z: number
  ccwYawRadians: number
}

/** World position and heading for an operator standing at a station. */
export function getStationStandPose(station: Station): StandPose {
  const table = TABLE_PLACEMENTS[station.tableId]
  const localX = station.alongTableM
  const localZ = FOLDING_TABLE.depthM / 2 + station.standoffFromEdgeM
  const cos = Math.cos(table.ccwYawRadians)
  const sin = Math.sin(table.ccwYawRadians)
  return {
    x: table.centerXM + localX * cos + localZ * sin,
    z: table.centerZM - localX * sin + localZ * cos,
    ccwYawRadians: table.ccwYawRadians + Math.PI,
  }
}
