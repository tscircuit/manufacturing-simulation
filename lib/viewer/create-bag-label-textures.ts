import type { StickerArtwork } from "lib/models/sticker"
import { CanvasTexture, SRGBColorSpace, type Texture } from "three"

const INK = "#111418"

/** Code 128-looking bars from a string, deterministic so every label matches. */
function drawBars(params: {
  context: CanvasRenderingContext2D
  value: string
  x: number
  y: number
  width: number
  height: number
}): void {
  const { context, value } = params
  const modules: number[] = []
  for (const character of `*${value}*`) {
    const code = character.charCodeAt(0)
    for (let bit = 0; bit < 6; bit++) modules.push(((code >> bit) & 1) + 1)
  }
  const total = modules.reduce((sum, width) => sum + width, 0)
  const unit = params.width / total
  let x = params.x
  for (const [index, width] of modules.entries()) {
    if (index % 2 === 0) {
      context.fillStyle = INK
      context.fillRect(x, params.y, width * unit, params.height)
    }
    x += width * unit
  }
}

/** A canvas whose long side runs down the label (sticker +Y on the plane), drawn as if the label were landscape. */
function createLandscapeCanvas(params: {
  shortPx: number
  longPx: number
  draw: (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => void
}): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = params.shortPx
  canvas.height = params.longPx
  const context = canvas.getContext("2d")
  if (!context) return canvas
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  // Turn the drawing so it reads along the label's long side.
  context.translate(canvas.width, 0)
  context.rotate(Math.PI / 2)
  params.draw(context, params.longPx, params.shortPx)
  return canvas
}

/**
 * Yellow ESD caution sticker (2" x 1") that comes with the bags: the ESD
 * hand-in-triangle symbol and the standard caution wording.
 */
function drawEsdCautionLabel(): HTMLCanvasElement {
  return createLandscapeCanvas({
    shortPx: 200,
    longPx: 400,
    draw: (context, width, height) => {
      context.fillStyle = "#f5c518"
      context.fillRect(0, 0, width, height)
      context.strokeStyle = INK
      context.lineWidth = 6
      context.strokeRect(8, 8, width - 16, height - 16)
      // ESD symbol: a triangle with a hand crossed out by a bar.
      context.fillStyle = INK
      context.beginPath()
      context.moveTo(90, 34)
      context.lineTo(156, 160)
      context.lineTo(24, 160)
      context.closePath()
      context.fill()
      context.fillStyle = "#f5c518"
      context.beginPath()
      context.moveTo(90, 62)
      context.lineTo(136, 148)
      context.lineTo(44, 148)
      context.closePath()
      context.fill()
      context.fillStyle = INK
      context.fillRect(80, 92, 20, 46)
      context.fillRect(70, 108, 10, 24)
      context.lineWidth = 7
      context.beginPath()
      context.moveTo(52, 144)
      context.lineTo(130, 78)
      context.stroke()
      context.font = "800 40px 'IBM Plex Sans', sans-serif"
      context.fillText("CAUTION", 176, 74)
      context.font = "700 21px 'IBM Plex Sans', sans-serif"
      context.fillText("ELECTROSTATIC", 176, 110)
      context.fillText("SENSITIVE", 176, 136)
      context.fillText("DEVICES", 176, 162)
    },
  })
}

/** Amazon FNSKU label, 1" x 2-5/8", as Seller Central prints it. */
function drawFnskuLabel(): HTMLCanvasElement {
  return createLandscapeCanvas({
    shortPx: 200,
    longPx: 525,
    draw: (context, width) => {
      drawBars({
        context,
        value: "X00TSC17RP",
        x: 40,
        y: 18,
        width: width - 80,
        height: 96,
      })
      context.fillStyle = INK
      context.font = "600 26px 'IBM Plex Mono', monospace"
      context.fillText("X00TSC17RP", 150, 146)
      context.font = "500 20px 'IBM Plex Sans', sans-serif"
      context.fillText("NEMA17 Motor Controller Kit", 40, 176)
      context.fillText("New", width - 80, 176)
    },
  })
}

/** FBA box ID label, 4" x 6": shipment, box number and the box barcode. */
function drawBoxIdLabel(): HTMLCanvasElement {
  return createLandscapeCanvas({
    shortPx: 400,
    longPx: 600,
    draw: (context, width) => {
      context.strokeStyle = INK
      context.lineWidth = 4
      context.strokeRect(8, 8, width - 16, 384)
      context.fillStyle = INK
      context.font = "700 34px 'IBM Plex Sans', sans-serif"
      context.fillText("FBA: tscircuit", 28, 56)
      context.font = "500 24px 'IBM Plex Sans', sans-serif"
      context.fillText("SHIP TO: Amazon fulfillment center", 28, 96)
      context.fillText("FBA15TSC0322 · Box 1 of 1", 28, 130)
      context.fillText("Mixed SKUs: No · Qty 30", 28, 162)
      drawBars({
        context,
        value: "FBA15TSC0322U000001",
        x: 28,
        y: 190,
        width: width - 56,
        height: 130,
      })
      context.font = "600 26px 'IBM Plex Mono', monospace"
      context.fillText("FBA15TSC0322U000001", 120, 360)
    },
  })
}

/** Canvas textures for the bare-unit line's labels; the kit label uses the approved artwork image. */
export function createBagLabelTextures(): Record<
  Exclude<StickerArtwork, "kit_label">,
  Texture
> {
  const make = (canvas: HTMLCanvasElement) => {
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }
  return {
    esd_caution: make(drawEsdCautionLabel()),
    fnsku: make(drawFnskuLabel()),
    fba_box: make(drawBoxIdLabel()),
  }
}
