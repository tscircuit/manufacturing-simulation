import { CanvasTexture, Sprite, SpriteMaterial, SRGBColorSpace } from "three"

const LABEL_WIDTH_PX = 512
const LABEL_HEIGHT_PX = 96

/** Floating name tag for a station. */
export function createLabelSprite(params: {
  text: string
  widthM: number
}): Sprite {
  const canvas = document.createElement("canvas")
  canvas.width = LABEL_WIDTH_PX
  canvas.height = LABEL_HEIGHT_PX
  const context = canvas.getContext("2d")
  if (!context) throw new Error("2D canvas is not available")
  context.fillStyle = "rgba(14,20,26,.82)"
  context.fillRect(0, 0, LABEL_WIDTH_PX, LABEL_HEIGHT_PX)
  context.fillStyle = "#ffc533"
  context.fillRect(0, 0, 10, LABEL_HEIGHT_PX)
  context.fillStyle = "#fff"
  context.font = '600 46px "IBM Plex Sans", system-ui, sans-serif'
  context.textBaseline = "middle"
  context.fillText(params.text, 30, 50)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const sprite = new Sprite(
    new SpriteMaterial({ map: texture, depthWrite: false }),
  )
  sprite.scale.set(
    params.widthM,
    (params.widthM * LABEL_HEIGHT_PX) / LABEL_WIDTH_PX,
    1,
  )
  return sprite
}
