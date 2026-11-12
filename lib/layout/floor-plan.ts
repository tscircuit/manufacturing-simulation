import { METERS_PER_FOOT } from "lib/units"

/**
 * Unit 322 at 2325, measured from the approximate floor plan.
 *
 * World axes: +X runs west to east, +Z runs north to south, +Y is up. The
 * origin is the NW inside corner. The entry door is in the NE corner and the
 * window wall is the west wall. The SW corner has a notch, so the west side is
 * shorter than the east side.
 */
export const FLOOR_PLAN = {
  widthM: 18.291 * METERS_PER_FOOT,
  eastLengthM: 47.437 * METERS_PER_FOOT,
  westLengthM: 46.02 * METERS_PER_FOOT,
  southNotchWidthM: 5.8 * METERS_PER_FOOT,
  wallHeightM: 2.74,
  entryDoorWidthM: 1.25,
  windowSillHeightM: 0.8,
  windowHeadHeightM: 2.5,
  windowMullionZPositionsM: [4.9, 9.1, 13.2, 17.2, 21.1, 32.1, 36.5, 41.3].map(
    (feet) => feet * METERS_PER_FOOT,
  ),
  windowColumnZM: 26.4 * METERS_PER_FOOT,
  washroom: {
    westWallXM: (18.291 - 3.4) * METERS_PER_FOOT,
    northWallZM: 5.65 * METERS_PER_FOOT,
    southWallZM: 11.36 * METERS_PER_FOOT,
    doorNorthZM: 6.9 * METERS_PER_FOOT,
    doorSouthZM: 9.4 * METERS_PER_FOOT,
  },
} as const

/** Length of the room along Z at a given X, accounting for the SW notch. */
export function getRoomLengthAtX(xM: number): number {
  return xM < FLOOR_PLAN.southNotchWidthM
    ? FLOOR_PLAN.westLengthM
    : FLOOR_PLAN.eastLengthM
}
