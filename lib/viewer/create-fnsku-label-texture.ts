import { CanvasTexture, SRGBColorSpace } from "three"

/** Illustrative bars and text for a sample label in the simulation. */
export function createFnskuLabelTexture(): CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = 630
  canvas.height = 240
  const context = canvas.getContext("2d")!
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = "#dadada"
  context.lineWidth = 2
  context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)

  context.fillStyle = "#141414"
  const bars = [
    6, 3, 9, 4, 6, 5, 3, 9, 6, 4, 9, 3, 5, 6, 3, 5, 9, 4, 6, 3, 5, 9, 4, 3, 6,
    9, 4, 5, 6, 3, 9, 6, 4, 3, 5, 6, 3, 9, 4, 5, 6, 9, 3, 4, 9, 6,
  ]
  let x = 60
  for (const [index, width] of bars.entries()) {
    context.fillRect(x, 35, width, 91)
    x += width + (index % 3 === 0 ? 7 : 4)
  }
  context.textAlign = "center"
  context.font = "bold 38px monospace"
  context.fillText("FNSKU SAMPLE", canvas.width / 2, 173)
  context.font = "28px sans-serif"
  context.fillText("NEMA17 USB Stepper Motor · New", canvas.width / 2, 209)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}
