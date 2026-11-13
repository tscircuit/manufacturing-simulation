import { getOccupants } from "lib/job/container-slots"
import type { JobStep, UnitParams } from "lib/job/job-step"
import {
  getCartonFocusPoint,
  SHIP_CLOSE_UP,
  sealAndShip,
} from "lib/job/ship-ready-steps"
import { STATIONS, type Station, type TableId } from "lib/layout/station-layout"
import type { SimContext } from "lib/simulation/sim-context"
import { carryWithBothHands } from "lib/tasks/carry-motions"
import type { SimTask } from "lib/tasks/coroutines"
import {
  ASSEMBLY_BENCH_SPOTS,
  PACK_OUT_BENCH_SPOTS,
  QC_BENCH_SPOTS,
  SHIP_READY_BENCH_SPOTS,
} from "lib/world/bench-spots"
import type { ManufacturingWorld } from "lib/world/create-world"
import { type Group, type Object3D, Vector3 } from "three"

/** A rack or tote that shuttles units between two benches. */
interface Shuttle {
  /** The container, from the world. */
  get: (world: ManufacturingWorld) => {
    group: Group
    leftHandle: Object3D
    rightHandle: Object3D
    occupants: Array<number | null>
  }
  name: string
  homeTable: TableId
  homeStation: Station
  homePosition: Vector3
  nextTable: TableId
  nextStation: Station
  nextPosition: Vector3
}

export const FINISHED_RACK_SHUTTLE: Shuttle = {
  get: (world) => world.finishedRack,
  name: "rack",
  homeTable: "assembly_bench",
  homeStation: STATIONS.assemblyRack,
  homePosition: ASSEMBLY_BENCH_SPOTS.finishedRack,
  nextTable: "qc_bench",
  nextStation: STATIONS.qc,
  nextPosition: QC_BENCH_SPOTS.incomingRack,
}

export const READY_RACK_SHUTTLE: Shuttle = {
  get: (world) => world.readyRack,
  name: "ready rack",
  homeTable: "qc_bench",
  homeStation: STATIONS.qc,
  homePosition: QC_BENCH_SPOTS.readyRack,
  nextTable: "pack_out_bench",
  nextStation: STATIONS.packOut,
  nextPosition: PACK_OUT_BENCH_SPOTS.incomingRack,
}

export const TOTE_SHUTTLE: Shuttle = {
  get: (world) => world.packingTote,
  name: "tote",
  homeTable: "pack_out_bench",
  homeStation: STATIONS.packOutLabels,
  homePosition: PACK_OUT_BENCH_SPOTS.tote,
  nextTable: "ship_ready_bench",
  nextStation: STATIONS.shipReady,
  nextPosition: SHIP_READY_BENCH_SPOTS.incomingTote,
}

function createShuttleSteps(params: {
  shuttle: Shuttle
  carryLabel: string
  returnLabel: string
}): {
  carry: JobStep
  returnHome: JobStep
} {
  const { shuttle } = params
  const focus = (ctx: SimContext) =>
    shuttle.get(ctx.world).group.getWorldPosition(new Vector3())
  return {
    carry: {
      label: params.carryLabel,
      station: shuttle.homeStation,
      closeUpView: {
        azimuthRadians: 1.2,
        elevationRadians: 0.7,
        distanceM: 1.6,
      },
      getFocusPoint: (_params, ctx) => focus(ctx),
      run: function* (_params: UnitParams, ctx: SimContext): SimTask {
        const container = shuttle.get(ctx.world)
        ctx.statusText = `Carrying the ${shuttle.name} (${getOccupants(container).length} units) to the next bench`
        yield* carryWithBothHands(
          {
            item: container.group,
            leftHandle: container.leftHandle,
            rightHandle: container.rightHandle,
            toStation: shuttle.nextStation,
            toParent: ctx.world.tables[shuttle.nextTable],
            toPosition: shuttle.nextPosition,
          },
          ctx,
        )
      },
    },
    returnHome: {
      label: params.returnLabel,
      station: shuttle.nextStation,
      closeUpView: {
        azimuthRadians: 1.2,
        elevationRadians: 0.7,
        distanceM: 1.6,
      },
      getFocusPoint: (_params, ctx) => focus(ctx),
      run: function* (_params: UnitParams, ctx: SimContext): SimTask {
        const container = shuttle.get(ctx.world)
        ctx.statusText = `Taking the empty ${shuttle.name} back`
        yield* carryWithBothHands(
          {
            item: container.group,
            leftHandle: container.leftHandle,
            rightHandle: container.rightHandle,
            toStation: shuttle.homeStation,
            toParent: ctx.world.tables[shuttle.homeTable],
            toPosition: shuttle.homePosition,
          },
          ctx,
        )
      },
    },
  }
}

const FINISHED_RACK_STEPS = createShuttleSteps({
  shuttle: FINISHED_RACK_SHUTTLE,
  carryLabel: "Carry the rack to QC",
  returnLabel: "Return the empty rack to assembly",
})
const READY_RACK_STEPS = createShuttleSteps({
  shuttle: READY_RACK_SHUTTLE,
  carryLabel: "Carry the ready rack to pack-out",
  returnLabel: "Return the empty ready rack to QC",
})
const TOTE_STEPS = createShuttleSteps({
  shuttle: TOTE_SHUTTLE,
  carryLabel: "Carry the tote to ship-ready",
  returnLabel: "Return the empty tote to pack-out",
})

/** One-off moves between benches; each is its own timing row. */
export const TRANSFER_STEPS = {
  carryFinishedRack: FINISHED_RACK_STEPS.carry,
  returnFinishedRack: FINISHED_RACK_STEPS.returnHome,
  carryReadyRack: READY_RACK_STEPS.carry,
  returnReadyRack: READY_RACK_STEPS.returnHome,
  carryTote: TOTE_STEPS.carry,
  returnTote: TOTE_STEPS.returnHome,
  sealAndShip: {
    label: "Seal carton, apply Box ID and carrier labels, ship",
    station: STATIONS.shipReady,
    closeUpView: { ...SHIP_CLOSE_UP, distanceM: 1.5 },
    getFocusPoint: (_params: UnitParams, ctx: SimContext) =>
      getCartonFocusPoint(ctx),
    run: sealAndShip,
  } satisfies JobStep,
}
