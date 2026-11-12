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
