import { FLOOR_PLAN } from "lib/layout/floor-plan"

export type TableId = "assembly_bench" | "printer_bench" | "pack_out_bench"

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
}

// Table positions are placeholders until the real unit 322 layout is known.
export const TABLE_PLACEMENTS: Record<TableId, TablePlacement> = {
  assembly_bench: {
    centerXM: 0.45,
    centerZM: 5.5,
    ccwYawRadians: Math.PI / 2,
    label: "Assembly bench",
  },
  printer_bench: {
    centerXM: FLOOR_PLAN.widthM - 0.45,
    centerZM: 5.6,
    ccwYawRadians: -Math.PI / 2,
    label: "P2S printer",
  },
  pack_out_bench: {
    centerXM: FLOOR_PLAN.widthM - 0.45,
    centerZM: 9.2,
    ccwYawRadians: -Math.PI / 2,
    label: "Pack-out",
  },
}

/** Where the P2S sits on the printer bench, in the table's local frame. */
export const PRINTER_ON_TABLE = { alongTableM: -0.35, depthOffsetM: 0.05 }

/** A place to stand at a table, measured in the table's local frame. */
export interface Station {
  tableId: TableId
  alongTableM: number
  standoffFromEdgeM: number
}

export const STATIONS = {
  printer: {
    tableId: "printer_bench",
    alongTableM: PRINTER_ON_TABLE.alongTableM + 0.06,
    standoffFromEdgeM: 0.36,
  },
  assembly: {
    tableId: "assembly_bench",
    alongTableM: 0,
    standoffFromEdgeM: 0.3,
  },
  packOut: {
    tableId: "pack_out_bench",
    alongTableM: 0,
    standoffFromEdgeM: 0.3,
  },
  finishedGoods: {
    tableId: "pack_out_bench",
    alongTableM: 0.58,
    standoffFromEdgeM: 0.3,
  },
} satisfies Record<string, Station>

export const OPERATOR_START = { xM: 2.9, zM: 3.0, ccwYawRadians: 0.2 }

/** Loop the operator walks in the "Walk the floor" scenario. */
export const PATROL_ROUTE = [
  { x: 2.8, z: 1.3 },
  { x: 1.7, z: 4.0 },
  { x: 2.9, z: 7.6 },
  { x: 1.6, z: 12.4 },
  { x: 3.9, z: 13.0 },
  { x: 3.5, z: 8.0 },
  { x: 3.2, z: 3.2 },
]
