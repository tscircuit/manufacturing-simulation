import type { FloorPoint } from "lib/navigation/floor-point"
import { isFloorPointFree } from "lib/navigation/is-floor-point-free"
import { MinHeap } from "lib/navigation/min-heap"
import {
  findNearestOpenCell,
  type GridCell,
  getCellAtPoint,
  getCellCenter,
  isCellOpen,
  type NavGrid,
} from "lib/navigation/nav-grid"

const LINE_OF_SIGHT_STEP_M = 0.05
const LINE_OF_SIGHT_CLEARANCE_M = 0.26
const DIAGONAL_COST = Math.SQRT2

/** True when the operator can walk straight from `from` to `to`. */
export function hasLineOfSight(params: {
  from: FloorPoint
  to: FloorPoint
}): boolean {
  const { from, to } = params
  const distanceM = Math.hypot(to.x - from.x, to.z - from.z)
  const sampleCount = Math.ceil(distanceM / LINE_OF_SIGHT_STEP_M)
  for (let sample = 1; sample < sampleCount; sample++) {
    const t = sample / sampleCount
    const isFree = isFloorPointFree({
      x: from.x + (to.x - from.x) * t,
      z: from.z + (to.z - from.z) * t,
      clearanceM: LINE_OF_SIGHT_CLEARANCE_M,
    })
    if (!isFree) return false
  }
  return true
}

function getOctileDistance(a: GridCell, b: GridCell): number {
  const dColumn = Math.abs(a.column - b.column)
  const dRow = Math.abs(a.row - b.row)
  return Math.max(dColumn, dRow) + (DIAGONAL_COST - 1) * Math.min(dColumn, dRow)
}

function searchGrid(
  params: { startCell: GridCell; goalCell: GridCell },
  navGrid: NavGrid,
): GridCell[] {
  const { startCell, goalCell } = params
  const { columnCount, rowCount } = navGrid
  const cellCount = columnCount * rowCount
  const costFromStart = new Float32Array(cellCount).fill(
    Number.POSITIVE_INFINITY,
  )
  const cameFrom = new Int32Array(cellCount).fill(-1)
  const isClosed = new Uint8Array(cellCount)
  const openSet = new MinHeap()
  const startIndex = startCell.row * columnCount + startCell.column
  const goalIndex = goalCell.row * columnCount + goalCell.column
  costFromStart[startIndex] = 0
  openSet.push({
    priority: getOctileDistance(startCell, goalCell),
    cellIndex: startIndex,
  })

  while (openSet.size > 0) {
    const currentIndex = openSet.pop() as number
    if (isClosed[currentIndex]) continue
    isClosed[currentIndex] = 1
    if (currentIndex === goalIndex) break
    const column = currentIndex % columnCount
    const row = (currentIndex - column) / columnCount
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
        if (columnOffset === 0 && rowOffset === 0) continue
        const neighbor = { column: column + columnOffset, row: row + rowOffset }
        if (!isCellOpen(neighbor, navGrid)) continue
        const neighborIndex = neighbor.row * columnCount + neighbor.column
        if (isClosed[neighborIndex]) continue
        const isDiagonal = columnOffset !== 0 && rowOffset !== 0
        // Don't cut corners past blocked cells.
        if (
          isDiagonal &&
          (!isCellOpen({ column: neighbor.column, row }, navGrid) ||
            !isCellOpen({ column, row: neighbor.row }, navGrid))
        ) {
          continue
        }
        const cost =
          costFromStart[currentIndex] + (isDiagonal ? DIAGONAL_COST : 1)
        if (cost < costFromStart[neighborIndex]) {
          costFromStart[neighborIndex] = cost
          cameFrom[neighborIndex] = currentIndex
          openSet.push({
            priority: cost + getOctileDistance(neighbor, goalCell),
            cellIndex: neighborIndex,
          })
        }
      }
    }
  }

  const cells: GridCell[] = []
  for (
    let cellIndex = goalIndex;
    cellIndex !== -1 && cellIndex !== startIndex;
    cellIndex = cameFrom[cellIndex]
  ) {
    const column = cellIndex % columnCount
    cells.push({ column, row: (cellIndex - column) / columnCount })
  }
  return cells.reverse()
}

/** Drop waypoints that can be skipped with a straight walk. */
function simplifyPath(params: {
  from: FloorPoint
  waypoints: FloorPoint[]
}): FloorPoint[] {
  const { waypoints } = params
  const simplified: FloorPoint[] = []
  let current = params.from
  let index = 0
  while (index < waypoints.length) {
    let furthest = waypoints.length - 1
    while (
      furthest > index &&
      !hasLineOfSight({ from: current, to: waypoints[furthest] })
    ) {
      furthest--
    }
    simplified.push(waypoints[furthest])
    current = waypoints[furthest]
    index = furthest + 1
  }
  return simplified
}

/**
 * Waypoints (excluding `from`, ending exactly at `to`) for walking around
 * walls and tables. Uses A* on the nav grid, then straightens the result.
 */
export function findPath(
  params: { from: FloorPoint; to: FloorPoint },
  navGrid: NavGrid,
): FloorPoint[] {
  const { from, to } = params
  if (hasLineOfSight({ from, to })) return [to]
  const startCell = findNearestOpenCell(getCellAtPoint(from, navGrid), navGrid)
  const goalCell = findNearestOpenCell(getCellAtPoint(to, navGrid), navGrid)
  const gridCells = searchGrid({ startCell, goalCell }, navGrid)
  const waypoints = gridCells.map((cell) => getCellCenter(cell, navGrid))
  waypoints.push(to)
  return simplifyPath({ from, waypoints })
}
