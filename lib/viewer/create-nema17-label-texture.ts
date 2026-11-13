import { NEMA17_LABEL_DATA_URL } from "lib/viewer/nema17-label-artwork"
import { CanvasTexture, SRGBColorSpace } from "three"

/** One branded unit sticker with illustrative bars and a visible sample mark. */
export function createNema17LabelTexture(): CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = 600
  canvas.height = 900
  const context = canvas.getContext("2d")!
  context.fillStyle = "#fff"
  context.fillRect(0, 0, canvas.width, canvas.height)

  const marginPx = 75
  const contentWidthPx = canvas.width - 2 * marginPx
  context.fillStyle = "#3b82f6"
  context.font = "bold 58px sans-serif"
  context.fillText("tscircuit", marginPx, 154)
  context.fillRect(marginPx, 212, contentWidthPx, 3)

  context.fillStyle = "#202124"
  context.font = "bold 85px sans-serif"
  context.fillText("NEMA17", marginPx, 325)
  context.font = "43px sans-serif"
  context.fillText("USB Stepper Motor", marginPx, 391, contentWidthPx)
  context.font = "31px sans-serif"
  context.fillText(
    "Made with AI using tscircuit.",
    marginPx,
    455,
    contentWidthPx,
  )
  context.fillStyle = "#3b82f6"
  context.fillRect(marginPx, 521, contentWidthPx, 3)

  context.fillStyle = "#111"
  const bars = [
    6, 3, 9, 4, 6, 5, 3, 9, 6, 4, 9, 3, 5, 6, 3, 5, 9, 4, 6, 3, 5, 9, 4, 3, 6,
    9, 4, 5, 6, 3, 9, 6, 4, 3, 5, 6, 3, 9, 4, 5, 6, 9, 3, 4, 9, 6,
  ]
  let x = marginPx
  for (const [index, width] of bars.entries()) {
    context.fillRect(x, 570, width, 117)
    x += width + (index % 3 === 0 ? 5 : 4)
  }

  context.textAlign = "center"
  context.font = "bold 41px monospace"
  context.fillText("FNSKU SAMPLE", canvas.width / 2, 749)
  context.font = "28px sans-serif"
  context.fillText(
    "NEMA17 USB Stepper Motor · New",
    canvas.width / 2,
    799,
    contentWidthPx,
  )

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8

  const branding = new Image()
  branding.onload = () => {
    context.fillStyle = "#fff"
    context.fillRect(marginPx, 74, contentWidthPx, 119)
    // Reuse the icon and wordmark from the approved NEMA17 artwork.
    context.drawImage(branding, 55, 134, 403, 109, marginPx, 82, 390, 106)
    texture.needsUpdate = true
  }
  branding.src = NEMA17_LABEL_DATA_URL
  return texture
}
