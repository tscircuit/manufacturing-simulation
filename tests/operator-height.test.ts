import { expect, test } from "bun:test"
import { OPERATOR_HEIGHT_M } from "lib/operator/operator-body"
import { ManufacturingSimulation } from "lib/simulation/manufacturing-simulation"
import { Box3 } from "three"

test("operator stands 6'2\" tall", () => {
  const simulation = new ManufacturingSimulation()
  const bounds = new Box3().setFromObject(simulation.ctx.operator.group, true)
  expect(OPERATOR_HEIGHT_M).toBeCloseTo(1.8796, 4)
  expect(bounds.max.y).toBeCloseTo(OPERATOR_HEIGHT_M, 1)
  expect(Math.abs(bounds.max.y - OPERATOR_HEIGHT_M)).toBeLessThan(0.015)
  expect(bounds.min.y).toBeGreaterThanOrEqual(-0.01)
})
