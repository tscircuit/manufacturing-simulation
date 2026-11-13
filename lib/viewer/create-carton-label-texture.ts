import { CanvasTexture, SRGBColorSpace } from "three"

/** A prop for the animation with decorative bars and an explicit sample mark. */
export function createCartonLabelTexture(
  kind: "box_id" | "carrier",
): CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = 400
  canvas.height = 600
  const context = canvas.getContext("2d")!
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = "#171717"
  if (kind === "carrier") {
    context.font = "bold 32px sans-serif"
    context.fillText("CARRIER TRACKING", 34, 63)
    context.font = "22px sans-serif"
    context.fillText("AMAZON PARTNERED · SPD", 34, 99)
    context.fillRect(34, 117, 332, 3)
    context.font = "bold 25px sans-serif"
    context.fillText("SHIP TO", 34, 155)
    context.font = "22px sans-serif"
    context.fillText("Amazon Fulfillment Center", 34, 185)
  } else {
    context.font = "bold 42px sans-serif"
    context.fillText("FBA BOX ID", 34, 91)
    context.font = "23px sans-serif"
    context.fillText("NEMA17  ·  CARTON 01", 34, 132)
    context.fillRect(34, 158, 332, 3)
  }

  const barWidths = [
    4, 3, 8, 3, 3, 6, 4, 3, 8, 4, 3, 4, 6, 3, 4, 8, 3, 6, 3, 3, 6, 4, 8, 3, 4,
    3, 8, 6, 3, 4, 6, 3, 4, 8, 4, 3, 3, 8,
  ]
  if (kind === "carrier") barWidths.reverse()
  let x = 34
  for (const [index, width] of barWidths.entries()) {
    context.fillRect(x, 210, width, 155)
    x += width + (index % 3 === 0 ? 6 : 3)
  }

  context.font = "bold 32px sans-serif"
  context.fillText("SIMULATION", 34, 435)
  context.font = "22px sans-serif"
  context.fillText(
    kind === "carrier" ? "SAMPLE TRACKING LABEL" : "SAMPLE LABEL",
    34,
    471,
  )
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}
