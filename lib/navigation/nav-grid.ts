import { FLOOR_PLAN } from "lib/layout/floor-plan"
import type { FloorPoint } from "lib/navigation/floor-point"
import { isFloorPointFree } from "lib/navigation/is-floor-point-free"

export interface GridCell {
  column: number
  row: number
}

/** Occupancy grid over the floor; a cell is blocked when the operator can't stand there. */
export interface NavGrid {
  cellSizeM: number
  columnCount: number
  rowCount: number
  blockedCells: Uint8Array
}

export function createNavGrid(params: {
  cellSizeM: number
  clearanceM: number
}): NavGrid {
  const { cellSizeM, clearanceM } = params
  const columnCount = Math.ceil(FLOOR_PLAN.widthM / cellSizeM)
  const rowCount = Math.ceil(FLOOR_PLAN.eastLengthM / cellSizeM)
  const blockedCells = new Uint8Array(columnCount * rowCount)
  for (let row = 0; row < rowCount; row++) {
    for (let column = 0; column < columnCount; column++) {
      const isFree = isFloorPointFree({
        x: (column + 0.5) * cellSizeM,
        z: (row + 0.5) * cellSizeM,
        clearanceM,
      })
      blockedCells[row * columnCount + column] = isFree ? 0 : 1
    }
  }
  return { cellSizeM, columnCount, rowCount, blockedCells }
}

export function isCellOpen(cell: GridCell, navGrid: NavGrid): boolean {
  const { column, row } = cell
  if (column < 0 || row < 0) return false
  if (column >= navGrid.columnCount || row >= navGrid.rowCount) return false
  return navGrid.blockedCells[row * navGrid.columnCount + column] === 0
}

export function getCellAtPoint(point: FloorPoint, navGrid: NavGrid): GridCell {
  return {
    column: Math.floor(point.x / navGrid.cellSizeM),
    row: Math.floor(point.z / navGrid.cellSizeM),
  }
}

export function getCellCenter(cell: GridCell, navGrid: NavGrid): FloorPoint {
  return {
    x: (cell.column + 0.5) * navGrid.cellSizeM,
    z: (cell.row + 0.5) * navGrid.cellSizeM,
  }
}

const MAX_SEARCH_RING = 30

/** Closest open cell to `cell`, searching outward in square rings. */
export function findNearestOpenCell(
  cell: GridCell,
  navGrid: NavGrid,
): GridCell {
  const start = {
    column: Math.min(Math.max(cell.column, 0), navGrid.columnCount - 1),
    row: Math.min(Math.max(cell.row, 0), navGrid.rowCount - 1),
  }
  if (isCellOpen(start, navGrid)) return start
  for (let ring = 1; ring < MAX_SEARCH_RING; ring++) {
    for (let rowOffset = -ring; rowOffset <= ring; rowOffset++) {
      for (let columnOffset = -ring; columnOffset <= ring; columnOffset++) {
        if (Math.max(Math.abs(columnOffset), Math.abs(rowOffset)) !== ring) {
          continue
        }
        const candidate = {
          column: start.column + columnOffset,
          row: start.row + rowOffset,
        }
        if (isCellOpen(candidate, navGrid)) return candidate
      }
    }
  }
  return start
}
