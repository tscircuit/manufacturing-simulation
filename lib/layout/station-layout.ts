export type TableId =
  | "spacer_bench"
  | "assembly_bench"
  | "qc_bench"
  | "pack_out_bench"
  | "ship_ready_bench"

/** A 6' plastic folding table: 72" x 30", 29" high. */
export const FOLDING_TABLE = {
  lengthM: 1.83,
  depthM: 0.76,
  topHeightM: 0.74,
} as const

/**
 * Table placement on the floor. Each table's long axis is its local X and the
 * operator works from its local +Z edge, facing local -Z.
 * `ccwYawRadians` is a counterclockwise rotation seen from above (Three.js
 * rotation about +Y).
 */
export interface TablePlacement {
  centerXM: number
  centerZM: number
  ccwYawRadians: number
  label: string
  /** Position along the line, shown on the station sign. */
  lineOrder: number
}

/** The line runs north to south along the window wall, one 6' table per station. */
const LINE_TABLE_CENTER_XM = 0.52
const LINE_FIRST_TABLE_CENTER_ZM = 2.0
const LINE_TABLE_PITCH_M = 1.83 + 0.05
/** Tables along the line face east, so their local +X points north. */
const LINE_TABLE_CCW_YAW_RADIANS = Math.PI / 2

function placeOnLine(params: {
  lineOrder: number
  label: string
}): TablePlacement {
  return {
    centerXM: LINE_TABLE_CENTER_XM,
    centerZM:
      LINE_FIRST_TABLE_CENTER_ZM + (params.lineOrder - 1) * LINE_TABLE_PITCH_M,
    ccwYawRadians: LINE_TABLE_CCW_YAW_RADIANS,
    ...params,
  }
}

// Positions follow the v2 line description; adjust once the real layout is measured.
export const TABLE_PLACEMENTS: Record<TableId, TablePlacement> = {
  spacer_bench: placeOnLine({ lineOrder: 1, label: "Spacer bench" }),
  assembly_bench: placeOnLine({ lineOrder: 2, label: "Assembly bench" }),
  qc_bench: placeOnLine({ lineOrder: 3, label: "QC bench" }),
  pack_out_bench: placeOnLine({ lineOrder: 4, label: "Pack-out bench" }),
  ship_ready_bench: placeOnLine({ lineOrder: 5, label: "Ship-ready bench" }),
}

/** A place to stand at a table, measured in the table's local frame. */
export interface Station {
  tableId: TableId
  alongTableM: number
  standoffFromEdgeM: number
}

export const STATIONS = {
  spacers: { tableId: "spacer_bench", alongTableM: 0, standoffFromEdgeM: 0.3 },
  assembly: {
    tableId: "assembly_bench",
    alongTableM: 0,
    standoffFromEdgeM: 0.3,
  },
  qc: { tableId: "qc_bench", alongTableM: -0.05, standoffFromEdgeM: 0.3 },
  packOut: {
    tableId: "pack_out_bench",
    alongTableM: 0,
    standoffFromEdgeM: 0.3,
  },
  shipReady: {
    tableId: "ship_ready_bench",
    alongTableM: 0.2,
    standoffFromEdgeM: 0.3,
  },
} satisfies Record<string, Station>

export const OPERATOR_START = { xM: 2.9, zM: 1.2, ccwYawRadians: -0.6 }

/** Loop the operator walks in the "Walk the floor" scenario. */
export const PATROL_ROUTE = [
  { x: 1.5, z: 1.6 },
  { x: 1.5, z: 6.0 },
  { x: 1.5, z: 10.4 },
  { x: 3.6, z: 12.6 },
  { x: 3.9, z: 7.0 },
  { x: 2.9, z: 1.3 },
]
