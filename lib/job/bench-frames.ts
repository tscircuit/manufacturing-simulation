import { type Object3D, Vector3 } from "three"
import type { TableId } from "lib/layout/station-layout"
import type { SimContext } from "lib/simulation/sim-context"
import {
  ASSEMBLY_BENCH_SPOTS,
  PACK_OUT_BENCH_SPOTS,
  QC_BENCH_SPOTS,
  SHIP_READY_BENCH_SPOTS,
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

function getTablePoint(
  params: { tableId: TableId; localPoint: Vector3 },
  ctx: SimContext,
): Vector3 {
  const table = ctx.world.tables[params.tableId]
  table.updateWorldMatrix(true, false)
  return table.localToWorld(params.localPoint.clone())
}

export function getSpacerBasketFocusPoint(ctx: SimContext): Vector3 {
  return getTablePoint(
    {
      tableId: "assembly_bench",
      // Between the basket and the spacer rest by the jig.
      localPoint: ASSEMBLY_BENCH_SPOTS.spacerBasket
        .clone()
        .add(new Vector3(-0.25, 0.05, 0.06)),
    },
    ctx,
  )
}

export function getJigFocusPoint(ctx: SimContext): Vector3 {
  const { jigTop } = ASSEMBLY_BENCH_SPOTS
  return getTablePoint(
    {
      tableId: "assembly_bench",
      localPoint: new Vector3(
        jigTop.x + 0.02,
        jigTop.y + 0.04,
        jigTop.z - 0.03,
      ),
    },
    ctx,
  )
}

export function getScrewdriverFocusPoint(ctx: SimContext): Vector3 {
  const { screwdriverRest, jigTop } = ASSEMBLY_BENCH_SPOTS
  return getTablePoint(
    {
      tableId: "assembly_bench",
      localPoint: new Vector3(
        screwdriverRest.x,
        screwdriverRest.y + 0.1,
        jigTop.z,
      ),
    },
    ctx,
  )
}

export function getQcFocusPoint(ctx: SimContext): Vector3 {
  const { cradle } = QC_BENCH_SPOTS
  return getTablePoint(
    {
      tableId: "qc_bench",
      localPoint: new Vector3(
        cradle.x + 0.05,
        cradle.y + 0.05,
        cradle.z - 0.08,
      ),
    },
    ctx,
  )
}

export function getPackingFocusPoint(ctx: SimContext): Vector3 {
  const { packing } = PACK_OUT_BENCH_SPOTS
  return getTablePoint(
    {
      tableId: "pack_out_bench",
      localPoint: new Vector3(packing.x - 0.03, packing.y + 0.06, packing.z),
    },
    ctx,
  )
}

export function getShipReadyFocusPoint(ctx: SimContext): Vector3 {
  const { outgoing } = SHIP_READY_BENCH_SPOTS
  return getTablePoint(
    {
      tableId: "ship_ready_bench",
      localPoint: new Vector3(outgoing.x, outgoing.y + 0.1, outgoing.z + 0.1),
    },
    ctx,
  )
}

/** Between the label sheet and the box, so both are in frame while labelling. */
export function getLabelFocusPoint(ctx: SimContext): Vector3 {
  const { packing, labelSheet } = PACK_OUT_BENCH_SPOTS
  return getTablePoint(
    {
      tableId: "pack_out_bench",
      localPoint: new Vector3(
        (packing.x + labelSheet.x) / 2,
        packing.y + 0.07,
        (packing.z + labelSheet.z) / 2,
      ),
    },
    ctx,
  )
}
