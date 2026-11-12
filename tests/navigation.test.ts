import { expect, test } from "bun:test"
import { getStationStandPose } from "lib/layout/get-station-stand-pose"
import { STATIONS, TABLE_PLACEMENTS } from "lib/layout/station-layout"
import { findPath, hasLineOfSight } from "lib/navigation/find-path"
import { isFloorPointFree } from "lib/navigation/is-floor-point-free"
import { createNavGrid } from "lib/navigation/nav-grid"

const navGrid = createNavGrid({ cellSizeM: 0.1, clearanceM: 0.27 })

test("tables, walls and the washroom are not walkable", () => {
  const bench = TABLE_PLACEMENTS.assembly_bench
  expect(
    isFloorPointFree({
      x: bench.centerXM,
      z: bench.centerZM,
      clearanceM: 0.25,
    }),
  ).toBe(false)
  expect(isFloorPointFree({ x: -0.1, z: 3, clearanceM: 0.25 })).toBe(false)
  expect(isFloorPointFree({ x: 5.3, z: 2.6, clearanceM: 0.25 })).toBe(false)
  expect(isFloorPointFree({ x: 2.8, z: 3, clearanceM: 0.25 })).toBe(true)
})

test("every station is reachable", () => {
  for (const station of Object.values(STATIONS)) {
    const pose = getStationStandPose(station)
    expect(isFloorPointFree({ x: pose.x, z: pose.z, clearanceM: 0.25 })).toBe(
      true,
    )
  }
})

test("paths between stations never cut through an obstacle", () => {
  const from = getStationStandPose(STATIONS.printer)
  const to = getStationStandPose(STATIONS.assembly)
  const path = findPath(
    { from: { x: from.x, z: from.z }, to: { x: to.x, z: to.z } },
    navGrid,
  )
  expect(path.at(-1)).toEqual({ x: to.x, z: to.z })
  let previous = { x: from.x, z: from.z }
  for (const waypoint of path) {
    expect(hasLineOfSight({ from: previous, to: waypoint })).toBe(true)
    previous = waypoint
  }
})
