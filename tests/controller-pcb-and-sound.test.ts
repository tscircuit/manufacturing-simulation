import { expect, test } from "bun:test"
import { createControllerPcb } from "lib/models/controller-pcb"
import { createNema17Motor } from "lib/models/nema17-motor"
import {
  RP2040_BOARD,
  RP2040_BOARD_PARTS,
} from "lib/models/rp2040-board-layout"
import { ManufacturingSimulation } from "lib/simulation/manufacturing-simulation"
import { Box3, Vector3 } from "three"

test("the controller board matches the RP2040 motor controller's size, ports and parts", () => {
  const pcb = createControllerPcb()
  const size = new Box3().setFromObject(pcb.group).getSize(new Vector3())
  // 42.3 mm square, plus the JST mouth 1.25 mm past the edge.
  expect(size.x).toBeGreaterThan(0.042)
  expect(size.x).toBeLessThan(0.0435)
  expect(size.z).toBeGreaterThan(0.0423)
  expect(size.z).toBeLessThan(0.0445)
  expect(RP2040_BOARD_PARTS.length).toBeGreaterThan(100)

  // Both USB-C ports open on the same edge, 13 mm apart; plugs point straight out of it.
  const out = new Vector3(0, 1, 0)
  for (const port of [pcb.dataPort, pcb.powerPort]) {
    expect(port.position.x).toBeCloseTo(-RP2040_BOARD.usbMouthYMm / 1000, 5)
    expect(out.clone().applyQuaternion(port.quaternion).x).toBeCloseTo(-1, 5)
  }
  expect(pcb.dataPort.position.distanceTo(pcb.powerPort.position)).toBeCloseTo(
    0.013,
    5,
  )
  // The PHR-4 slides in parallel to the board, toward the motor's own cable socket (-Z).
  const motorCableOut = out.clone().applyQuaternion(pcb.motorHeader.quaternion)
  expect(motorCableOut.z).toBeCloseTo(-1, 5)
  expect(motorCableOut.y).toBeCloseTo(0, 5)
  const motor = createNema17Motor()
  expect(Math.sign(motor.cableSocket.position.z)).toBe(
    Math.sign(pcb.motorHeader.position.z),
  )
})

test(
  "assembly and QC ask for their sounds",
  () => {
    const simulation = new ManufacturingSimulation()
    const heard: string[] = []
    simulation.setJobUnitCount(1)
    simulation.startScenario("run_batch")
    for (
      let elapsedSeconds = 0;
      elapsedSeconds < 400 && simulation.isTaskRunning;
      elapsedSeconds += 0.05
    ) {
      simulation.step(0.05)
      heard.push(...simulation.ctx.soundCues.splice(0))
    }
    for (const cue of [
      "screw_drop",
      "usb_click",
      "jst_click",
      "board_chirp",
      "qc_pass",
      "plug_pull",
      "box_close",
      "tape_gun",
    ])
      expect(heard).toContain(cue)
  },
  { timeout: 60_000 },
)
