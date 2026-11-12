import { createStandardMaterial } from "lib/scene/primitives"

export const STEEL_MATERIAL = createStandardMaterial({
  color: 0xb9bec4,
  metalness: 0.8,
  roughness: 0.35,
})
export const BLACK_PLASTIC_MATERIAL = createStandardMaterial({
  color: 0x1c1e21,
  roughness: 0.5,
})
export const DARK_METAL_MATERIAL = createStandardMaterial({
  color: 0x2c3035,
  roughness: 0.6,
})
export const DOOR_WOOD_MATERIAL = createStandardMaterial({ color: 0x8a6a48 })
