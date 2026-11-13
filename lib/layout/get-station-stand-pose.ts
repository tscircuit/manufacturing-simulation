import {
  type Station,
  TABLE_PLACEMENTS,
  type TableLayout,
  WORK_TABLE,
} from "lib/layout/station-layout"

export interface StandPose {
  x: number
  z: number
  ccwYawRadians: number
}

/** World position and heading for an operator standing at a station. */
export function getStationStandPose(
  station: Station,
  layout: TableLayout = TABLE_PLACEMENTS,
): StandPose {
  const table = layout[station.tableId] ?? TABLE_PLACEMENTS[station.tableId]
  const localX = station.alongTableM
  const localZ = WORK_TABLE.depthM / 2 + station.standoffFromEdgeM
  const cos = Math.cos(table.ccwYawRadians)
  const sin = Math.sin(table.ccwYawRadians)
  return {
    x: table.centerXM + localX * cos + localZ * sin,
    z: table.centerZM - localX * sin + localZ * cos,
    ccwYawRadians: table.ccwYawRadians + Math.PI,
  }
}
