import { type Object3D, Vector3 } from "three"
import type { TableId } from "lib/layout/station-layout"
import type { SimContext } from "lib/simulation/sim-context"
import {
  ASSEMBLY_BENCH_SPOTS,
  PACK_OUT_BENCH_SPOTS,
} from "lib/world/bench-spots"

/** Express a point fixed to `object` in a table's local frame. */
export function getPointInTableFrame(
  params: { tableId: TableId; object: Object3D; localPoint: Vector3 },
  ctx: SimContext,
): Vector3 {
  const table = ctx.world.tables[params.tableId]
  params.object.updateWorldMatrix(true, false)
  table.updateWorldMatrix(true, false)
  return table.worldToLocal(
    params.object.localToWorld(params.localPoint.clone()),
  )
}

export function getJigFocusPoint(ctx: SimContext): Vector3 {
  const { jigTop } = ASSEMBLY_BENCH_SPOTS
  return ctx.world.tables.assembly_bench.localToWorld(
    new Vector3(jigTop.x + 0.03, jigTop.y + 0.04, jigTop.z),
  )
}

export function getBoxFocusPoint(ctx: SimContext): Vector3 {
  const { boxFolding } = PACK_OUT_BENCH_SPOTS
  return ctx.world.tables.pack_out_bench.localToWorld(
    new Vector3(boxFolding.x + 0.05, boxFolding.y + 0.05, boxFolding.z),
  )
}

export function getScrewdriverFocusPoint(ctx: SimContext): Vector3 {
  const { screwdriverRest } = ASSEMBLY_BENCH_SPOTS
  return ctx.world.tables.assembly_bench.localToWorld(
    new Vector3(
      screwdriverRest.x,
      screwdriverRest.y + 0.1,
      ASSEMBLY_BENCH_SPOTS.jigTop.z,
    ),
  )
}
