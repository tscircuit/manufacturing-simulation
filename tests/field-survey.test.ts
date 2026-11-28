import { expect, test } from "bun:test"
import {
  antennaSite,
  cartSite,
  duration,
  motorSite,
  sampleSurvey,
} from "lib/field-survey/plan"

test("seeking straight to a sweep deploys both kits 3 m apart and reproduces both polarizations", () => {
  expect(motorSite.distanceTo(antennaSite)).toBeCloseTo(3)
  for (const [start, length, on, spinning] of [
    [39, 6, false, false],
    [45, 6, true, false],
    [51, 8, true, true],
  ] as const) {
    const horizontal = sampleSurvey(start + 1)
    const vertical = sampleSurvey(start + length - 1)
    expect(horizontal.cart.distanceTo(cartSite)).toBeCloseTo(0)
    expect(horizontal.tableOpen).toBe(1)
    expect(horizontal.antennaOpen).toBe(1)
    expect(horizontal.scanning).toBe(true)
    expect(horizontal.motorOn).toBe(on)
    expect(horizontal.spinning).toBe(spinning)
    expect(horizontal.vertical).toBe(0)
    expect(vertical.vertical).toBe(1)
  }
})

test("both kits travel on the cart, deploy in sequence, and stow before the return", () => {
  const outgoing = sampleSurvey(12)
  const firstKit = sampleSurvey(30)
  const collectingTripod = sampleSurvey(65)
  const inbound = sampleSurvey(84)
  expect(outgoing.pushing).toBe(true)
  expect(outgoing.tableTravel).toBe(0)
  expect(outgoing.antennaTravel).toBe(0)
  expect(firstKit.tableOpen).toBe(1)
  expect(firstKit.antennaTravel).toBe(0)
  expect(collectingTripod.carrying).toBe(true)
  expect(collectingTripod.tableOpen).toBe(1)
  expect(collectingTripod.antennaOpen).toBe(0)
  expect(inbound.pushing).toBe(true)
  expect(inbound.tableTravel).toBe(0)
  expect(inbound.antennaTravel).toBe(0)
  expect(
    sampleSurvey(duration).cart.distanceTo(sampleSurvey(0).cart),
  ).toBeCloseTo(0)
  expect(sampleSurvey(duration).walking).toBe(false)
})
