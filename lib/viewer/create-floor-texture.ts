import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three"
import { METERS_PER_FOOT } from "lib/units"

const TILE_SIZE_M = 2 * METERS_PER_FOOT
const TEXTURE_SIZE_PX = 128

/** 2' square floor tiles drawn in the theme's floor colors. */
export function createFloorTexture(params: {
  tileColor: string
  groutColor: string
}): CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = TEXTURE_SIZE_PX
  canvas.height = TEXTURE_SIZE_PX
  const context = canvas.getContext("2d")
  if (!context) throw new Error("2D canvas is not available")
  context.fillStyle = params.tileColor
  context.fillRect(0, 0, TEXTURE_SIZE_PX, TEXTURE_SIZE_PX)
  context.strokeStyle = params.groutColor
  context.lineWidth = 2
  context.strokeRect(0, 0, TEXTURE_SIZE_PX, TEXTURE_SIZE_PX)
  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(1 / TILE_SIZE_M, 1 / TILE_SIZE_M)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}
