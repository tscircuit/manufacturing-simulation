import { getSideJobAt } from "lib/job/side-jobs"
import { getStationStandPose } from "lib/layout/get-station-stand-pose"
import { STATIONS, type Station, type TableId } from "lib/layout/station-layout"
import type { SideJob, SimContext } from "lib/simulation/sim-context"

/** A floor circle in front of the label printer or a 3D printer. Standing on it offers that equipment's job. */
export interface EquipmentPad {
  id: "label_printer" | "p2s" | "h2s"
  station: Station
  tableId: TableId
}

export const EQUIPMENT_PADS: EquipmentPad[] = [
  {
    id: "label_printer",
    station: STATIONS.labelPrinter,
    tableId: "label_bench",
  },
  { id: "p2s", station: STATIONS.p2s, tableId: "printer_bench" },
  { id: "h2s", station: STATIONS.h2s, tableId: "printer_bench" },
]

/** How close to a pad's centre counts as standing on it. */
export const EQUIPMENT_PAD_RADIUS_M = 0.38

export function getEquipmentPadAtOperator(
  ctx: SimContext,
): EquipmentPad | null {
  const { x, z } = ctx.operator.position
  for (const pad of EQUIPMENT_PADS) {
    const pose = getStationStandPose(pad.station, ctx.tableLayout)
    if (Math.hypot(x - pose.x, z - pose.z) <= EQUIPMENT_PAD_RADIUS_M) return pad
  }
  return null
}

/** What standing on this pad offers right now, if anything. */
export function getPadJob(pad: EquipmentPad, ctx: SimContext): SideJob | null {
  return getSideJobAt({ tableId: pad.tableId }, ctx)
}

/** The two circles at the assembly bench when building one motor at a time. */
export interface AssemblyPad {
  id: "assemble" | "rack"
  station: Station
}

export const ASSEMBLY_PADS: AssemblyPad[] = [
  { id: "assemble", station: STATIONS.assembly },
  { id: "rack", station: STATIONS.assemblyRack },
]

/** Smaller than the equipment circles: the two sit side by side at one bench. */
export const ASSEMBLY_PAD_RADIUS_M = 0.26

export function getAssemblyPadAtOperator(ctx: SimContext): AssemblyPad | null {
  // Only the full kit line has an assembly bench.
  if (!ctx.tableLayout.assembly_bench) return null
  const { x, z } = ctx.operator.position
  for (const pad of ASSEMBLY_PADS) {
    const pose = getStationStandPose(pad.station, ctx.tableLayout)
    if (Math.hypot(x - pose.x, z - pose.z) <= ASSEMBLY_PAD_RADIUS_M) return pad
  }
  return null
}
