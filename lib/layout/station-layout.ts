import { FLOOR_PLAN } from "lib/layout/floor-plan"
import { METERS_PER_INCH } from "lib/units"

export type TableId =
  | "assembly_bench"
  | "qc_bench"
  | "pack_out_bench"
  | "ship_ready_bench"
  | "printer_bench"
  | "label_bench"

/**
 * Units per batch: the motor foam stand, both racks and the tote each hold a
 * full batch, and one Amazon carton ships it.
 */
export const BATCH_SIZE = 30

/**
 * Electric standing desk with a 72" x 30" top, set to 42" for a 6'2"
 * operator: about 10 cm below his elbows, so he works upright.
 */
export const WORK_TABLE = {
  lengthM: 1.83,
  depthM: 0.76,
  topHeightM: 42 * METERS_PER_INCH,
  topThicknessM: 0.025,
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
  /** Position along the line, shown on the station sign; 0 for benches off the line. */
  lineOrder: number
}

/** The line runs north to south along the window wall, one 6' table per station. */
const LINE_TABLE_CENTER_XM = 0.52
const LINE_FIRST_TABLE_CENTER_ZM = 2.0
const LINE_TABLE_PITCH_M = 1.83 + 0.05
/** Tables along the line face east, so their local +X points north. */
const LINE_TABLE_CCW_YAW_RADIANS = Math.PI / 2
/** Benches on the east wall face west. */
const EAST_WALL_TABLE_CENTER_XM = FLOOR_PLAN.widthM - 0.45
const EAST_WALL_TABLE_CCW_YAW_RADIANS = -Math.PI / 2

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

function placeOnEastWall(params: {
  centerZM: number
  label: string
}): TablePlacement {
  return {
    centerXM: EAST_WALL_TABLE_CENTER_XM,
    centerZM: params.centerZM,
    ccwYawRadians: EAST_WALL_TABLE_CCW_YAW_RADIANS,
    label: params.label,
    lineOrder: 0,
  }
}

// Positions follow the line description; adjust once the real layout is measured.
export const TABLE_PLACEMENTS: Record<TableId, TablePlacement> = {
  assembly_bench: placeOnLine({ lineOrder: 1, label: "Assembly bench" }),
  qc_bench: placeOnLine({ lineOrder: 2, label: "QC bench" }),
  pack_out_bench: placeOnLine({ lineOrder: 3, label: "Pack-out bench" }),
  ship_ready_bench: placeOnLine({ lineOrder: 4, label: "Ship-ready bench" }),
  // Where the P2S bench stood in the first version, south of the washroom.
  printer_bench: placeOnEastWall({ centerZM: 5.6, label: "3D printers" }),
  label_bench: placeOnEastWall({
    centerZM: 5.6 + LINE_TABLE_PITCH_M,
    label: "Label printer",
  }),
}

/** A place to stand at a table, measured in the table's local frame. */
export interface Station {
  tableId: TableId
  alongTableM: number
  standoffFromEdgeM: number
}

export const STATIONS = {
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
  /** Downstream end of the pack-out bench, by the labels and the tote. */
  packOutLabels: {
    tableId: "pack_out_bench",
    alongTableM: -0.4,
    standoffFromEdgeM: 0.3,
  },
  shipReady: {
    tableId: "ship_ready_bench",
    alongTableM: 0.15,
    standoffFromEdgeM: 0.3,
  },
  p2s: {
    tableId: "printer_bench",
    alongTableM: -0.45,
    standoffFromEdgeM: 0.32,
  },
  h2s: { tableId: "printer_bench", alongTableM: 0.35, standoffFromEdgeM: 0.36 },
  labelPrinter: {
    tableId: "label_bench",
    alongTableM: 0,
    standoffFromEdgeM: 0.3,
  },
} satisfies Record<string, Station>

/** Floor spot by the entry door where sealed cartons wait for pickup. */
export const OUTBOUND_SPOT = {
  xM: FLOOR_PLAN.widthM - 1.1,
  zM: 0.75,
  ccwYawRadians: 0,
}

export const OPERATOR_START = { xM: 2.9, zM: 1.2, ccwYawRadians: -0.6 }

/** Loop the operator walks in the "Walk the floor" scenario. */
export const PATROL_ROUTE = [
  { x: 1.5, z: 1.6 },
  { x: 1.5, z: 6.0 },
  { x: 1.5, z: 8.6 },
  { x: 3.6, z: 12.6 },
  { x: 3.8, z: 7.0 },
  { x: 2.9, z: 1.3 },
]
