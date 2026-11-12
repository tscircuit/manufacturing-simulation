import { CanvasTexture, SRGBColorSpace } from "three"
import type { QcDisplayState } from "lib/models/qc-laptop"

const WIDTH_PX = 540
const HEIGHT_PX = 340

const STATE_COPY: Record<
  QcDisplayState,
  { chip: string; chipColor: string; headline: string; detail: string }
> = {
  idle: {
    chip: "READY",
    chipColor: "#5a6876",
    headline: "Connect board",
    detail: "Plug USB-C data and PD power",
  },
  testing: {
    chip: "TESTING",
    chipColor: "#4aa3ff",
    headline: "Spinning…",
    detail: "9 rev · checking current and stall",
  },
  pass: {
    chip: "PASS",
    chipColor: "#58d39a",
    headline: "Motor OK",
    detail: "Spin, current and temperature in range",
  },
}

/** The motor-bench QC page as the laptop shows it in each test state. */
export function createQcScreenTexture(state: QcDisplayState): CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = WIDTH_PX
  canvas.height = HEIGHT_PX
  const context = canvas.getContext("2d")
  if (!context) throw new Error("2D canvas is not available")
  const copy = STATE_COPY[state]
  context.fillStyle = "#161d26"
  context.fillRect(0, 0, WIDTH_PX, HEIGHT_PX)
  context.fillStyle = "#8a98a7"
  context.font = '500 18px "IBM Plex Mono", monospace'
  context.fillText("MOTOR CONTROLLER · QC", 30, 44)
  context.fillStyle = "#e4eaf0"
  context.font = '600 40px "IBM Plex Sans", sans-serif'
  context.fillText(copy.headline, 30, 150)
  context.fillStyle = "#8a98a7"
  context.font = '400 20px "IBM Plex Sans", sans-serif'
  context.fillText(copy.detail, 30, 190)
  context.fillStyle = copy.chipColor
  context.fillRect(30, 240, 150, 54)
  context.fillStyle = "#0c1116"
  context.font = '700 26px "IBM Plex Mono", monospace'
  context.fillText(copy.chip, 46, 276)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}
