import { DoubleSide, Mesh, MeshBasicMaterial, RingGeometry } from "three"

/** Pulsing floor ring that marks where the next job step happens. */
export function createStationRing(): Mesh<RingGeometry, MeshBasicMaterial> {
  const ring = new Mesh(
    new RingGeometry(0.2, 0.26, 40),
    new MeshBasicMaterial({
      color: 0xffc533,
      transparent: true,
      opacity: 0.8,
      side: DoubleSide,
      depthWrite: false,
    }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.visible = false
  return ring
}

/** A filled floor circle with a bright rim: the stand-here spot for a printer or the label printer. */
export function createEquipmentPadMesh(
  radiusM: number,
): Mesh<RingGeometry, MeshBasicMaterial> {
  const pad = new Mesh(
    new RingGeometry(radiusM * 0.86, radiusM, 48),
    new MeshBasicMaterial({
      color: 0x3aa0ff,
      transparent: true,
      opacity: 0.6,
      side: DoubleSide,
      depthWrite: false,
    }),
  )
  pad.rotation.x = -Math.PI / 2
  const fill = new Mesh(
    new RingGeometry(0, radiusM * 0.86, 48),
    new MeshBasicMaterial({
      color: 0x3aa0ff,
      transparent: true,
      opacity: 0.14,
      side: DoubleSide,
      depthWrite: false,
    }),
  )
  pad.add(fill)
  return pad
}
