import {
  getLayoutPlacements,
  type TablePlacement,
  WORK_TABLE,
} from "lib/layout/station-layout"
import type { OperatorHand } from "lib/operator/create-operator"
import type { SimContext } from "lib/simulation/sim-context"
import { runInParallel, type SimTask, tween } from "lib/tasks/coroutines"
import { reachHand, trackObjectPoint } from "lib/tasks/operator-motions"
import { Box3, type Object3D, Quaternion, Vector3 } from "three"

/** Something the operator was holding or moving when the task paused, set down until they come back. */
export interface ParkedObject {
  object: Object3D
  /** Where it belongs in the paused task: its parent and pose there. */
  parent: Object3D
  localPosition: Vector3
  localQuaternion: Quaternion
  /** Its pose at the moment of the pause, to pick it back up to. */
  worldPosition: Vector3
  worldQuaternion: Quaternion
  hand: OperatorHand | null
}

/** Rest height under a point: a bench top if it's over one, otherwise the floor. */
function getSurfaceHeightM(params: {
  point: Vector3
  tables: TablePlacement[]
}): number {
  const { point } = params
  for (const table of params.tables) {
    const dx = point.x - table.centerXM
    const dz = point.z - table.centerZM
    const cos = Math.cos(table.ccwYawRadians)
    const sin = Math.sin(table.ccwYawRadians)
    const alongM = dx * cos - dz * sin
    const acrossM = dx * sin + dz * cos
    if (
      Math.abs(alongM) <= WORK_TABLE.lengthM / 2 &&
      Math.abs(acrossM) <= WORK_TABLE.depthM / 2
    )
      return WORK_TABLE.topHeightM
  }
  return 0
}

/** Objects mid-move hang off the world root; benches, wires and the shipped carton live there for good. */
function getObjectsInTransit(ctx: SimContext): Object3D[] {
  const { world } = ctx
  const permanent = new Set<Object3D>([
    ...Object.values(world.tables),
    ...world.cables.map((cable) => cable.wire),
  ])
  if (world.isCartonShipped) permanent.add(world.carton.group)
  return world.root.children.filter((child) => !permanent.has(child))
}

/**
 * The player walked away from a paused task: set down whatever was in hand
 * or mid-move, straight below where it was, on the bench (or the floor).
 * Nothing is left hanging in the air, and both hands are free.
 */
export function parkHeldWork(ctx: SimContext): ParkedObject[] {
  const { world, operator } = ctx
  const handFor = new Map<Object3D, OperatorHand>()
  const candidates: Object3D[] = []
  for (const hand of operator.hands) {
    if (hand.heldObject) {
      candidates.push(hand.heldObject)
      handFor.set(hand.heldObject, hand)
    }
  }
  candidates.push(...getObjectsInTransit(ctx))
  const parked: ParkedObject[] = []
  for (const object of candidates) {
    const parent = object.parent
    if (!parent) continue
    object.updateWorldMatrix(true, true)
    const worldPosition = object.getWorldPosition(new Vector3())
    const worldQuaternion = object.getWorldQuaternion(new Quaternion())
    parked.push({
      object,
      parent,
      localPosition: object.position.clone(),
      localQuaternion: object.quaternion.clone(),
      worldPosition,
      worldQuaternion,
      hand: handFor.get(object) ?? null,
    })
    world.root.attach(object)
    object.updateWorldMatrix(true, true)
    const bounds = new Box3().setFromObject(object)
    const surfaceM = getSurfaceHeightM({
      point: bounds.getCenter(new Vector3()),
      tables: getLayoutPlacements(ctx.tableLayout),
    })
    object.position.y -= bounds.min.y - surfaceM - 0.0005
  }
  for (const hand of operator.hands) hand.heldObject = null
  return parked
}

/** Back at the work: pick each parked object up again to exactly where it was, then carry on. */
export function* unparkWork(
  params: { parked: ParkedObject[] },
  ctx: SimContext,
): SimTask {
  const { parked } = params
  if (parked.length === 0) return
  const { operator } = ctx
  const reaches: SimTask[] = []
  for (const entry of parked) {
    const hand = entry.hand ?? operator.rightHand
    if (reaches.length < operator.hands.length)
      reaches.push(
        reachHand({
          hand,
          getTarget: trackObjectPoint({ object: entry.object }),
          durationSeconds: 0.45,
        }),
      )
  }
  yield* runInParallel(reaches)
  const starts = parked.map((entry) => ({
    position: entry.object.position.clone(),
    quaternion: entry.object.quaternion.clone(),
  }))
  yield* tween({
    durationSeconds: 0.45,
    onProgress: (progress) => {
      for (const [index, entry] of parked.entries()) {
        entry.object.position.lerpVectors(
          starts[index].position,
          entry.worldPosition,
          progress,
        )
        entry.object.quaternion
          .copy(starts[index].quaternion)
          .slerp(entry.worldQuaternion, progress)
      }
    },
  })
  for (const entry of parked) {
    entry.parent.add(entry.object)
    entry.object.position.copy(entry.localPosition)
    entry.object.quaternion.copy(entry.localQuaternion)
    if (entry.hand) entry.hand.heldObject = entry.object
  }
}
