import { STATIONS } from "lib/layout/station-layout"
import {
  BAMBU_PRINTERS,
  type BambuPrinter,
  PRINTER_STATUS_COLORS,
  populatePlate,
} from "lib/models/bambu-printer"
import {
  ASSEMBLY_SPACER_BASKET,
  getSpacerCapacity,
  getSpacerPilePosition,
  SPACER_TUB,
  type SpacerContainerSize,
} from "lib/models/spacer-basket"
import type { SimContext } from "lib/simulation/sim-context"
import { pickUpInFront } from "lib/tasks/carry-motions"
import { runInParallel, type SimTask, tween } from "lib/tasks/coroutines"
import {
  grabObject,
  moveObject,
  releaseHand,
  walkToStation,
} from "lib/tasks/operator-motions"
import {
  ASSEMBLY_BENCH_SPOTS,
  IDENTITY_QUATERNION,
} from "lib/world/bench-spots"
import { scatter } from "lib/world/create-world"
import { type Group, type Object3D, Vector3 } from "three"

const DOOR_OPEN_CCW_YAW_RADIANS = -1.75
const TUB_NESTING_M = 0.012

function getGrip(params: { container: Group; name: string }): Object3D {
  const grip = params.container.getObjectByName(params.name)
  if (!grip) throw new Error(`Container has no ${params.name}`)
  return grip
}

/** Finish every running print now, as if the print time had passed. */
export function finishPrintsNow(ctx: SimContext): void {
  for (const printer of ctx.world.printers) {
    if (printer.isPrinting)
      printer.printedSeconds =
        BAMBU_PRINTERS[printer.model].estimatedPlateSeconds
  }
  advancePrinters({ dtSeconds: 0, populate: populatePlate }, ctx)
}

/** Printers holding a finished plate of spacers. */
export function getFinishedPrinters(ctx: SimContext): BambuPrinter[] {
  return ctx.world.printers.filter(
    (printer) => !printer.isPrinting && printer.plateSpacers.length > 0,
  )
}

/** Advance every running print and fill the plate when it finishes. */
export function advancePrinters(
  params: { dtSeconds: number; populate: (printer: BambuPrinter) => void },
  ctx: SimContext,
): void {
  for (const printer of ctx.world.printers) {
    if (!printer.isPrinting) continue
    printer.printedSeconds += params.dtSeconds
    if (
      printer.printedSeconds <
      BAMBU_PRINTERS[printer.model].estimatedPlateSeconds
    )
      continue
    printer.isPrinting = false
    params.populate(printer)
    printer.statusLight.material.color.setHex(PRINTER_STATUS_COLORS.ready)
  }
}

/** Move a handful of spacers at once into a container's pile, each along a short arc. */
function* pourSpacers(
  params: {
    spacers: Group[]
    container: Group
    size: SpacerContainerSize
    firstPileIndex: number
    durationSeconds: number
  },
  ctx: SimContext,
): SimTask {
  const { spacers, container } = params
  for (const spacer of spacers) ctx.world.root.attach(spacer)
  container.updateWorldMatrix(true, false)
  const starts = spacers.map((spacer) => spacer.position.clone())
  const ends = spacers.map((_, index) =>
    container.localToWorld(
      getSpacerPilePosition({
        index: params.firstPileIndex + index,
        container: params.size,
      }),
    ),
  )
  yield* tween({
    durationSeconds: params.durationSeconds,
    onProgress: (progress) => {
      for (const [index, spacer] of spacers.entries()) {
        // Stagger each spacer a little so they tumble in rather than move as one.
        const delay = scatter(index + 700) * 0.35
        const local = Math.min(1, Math.max(0, (progress - delay) / (1 - 0.35)))
        spacer.position.lerpVectors(starts[index], ends[index], local)
        spacer.position.y += Math.sin(Math.PI * local) * 0.08
        spacer.rotation.x = local * (scatter(index + 760) - 0.5) * 4
      }
    },
  })
  for (const [index, spacer] of spacers.entries()) {
    container.attach(spacer)
    spacer.position.copy(
      getSpacerPilePosition({
        index: params.firstPileIndex + index,
        container: params.size,
      }),
    )
    spacer.rotation.set(
      0,
      (scatter(params.firstPileIndex + index + 80) - 0.5) * 0.8,
      0,
    )
  }
}

function* collectPlate(
  params: { printer: BambuPrinter; tub: Group },
  ctx: SimContext,
): SimTask {
  const { printer, tub } = params
  const { world, operator } = ctx
  const spec = BAMBU_PRINTERS[printer.model]
  yield* walkToStation(
    printer.model === "P2S" ? STATIONS.p2s : STATIONS.h2s,
    ctx,
  )
  ctx.statusText = `Opening the ${printer.model}`
  yield* grabObject({
    hand: operator.leftHand,
    object: printer.doorHandle,
    fingerCurl: 0.8,
    durationSeconds: 0.7,
  })
  yield* tween({
    durationSeconds: 1,
    onProgress: (progress) => {
      printer.door.rotation.y = DOOR_OPEN_CCW_YAW_RADIANS * progress
    },
  })
  yield* releaseHand(operator.leftHand)

  ctx.statusText = `Pulling the ${printer.model} plate: ${printer.plateSpacers.length} spacers`
  const tabPoint = new Vector3(0, 0.002, spec.bedDepthM / 2 + 0.01)
  yield* grabObject({
    hand: operator.rightHand,
    object: printer.plate,
    localGripPoint: tabPoint,
    fingerCurl: 0.9,
    durationSeconds: 0.7,
  })
  yield* moveObject(
    {
      object: printer.plate,
      hand: operator.rightHand,
      parent: printer.group,
      localPosition: printer.plateHome
        .clone()
        .add(new Vector3(0, 0.03, spec.depthM / 2 + spec.bedDepthM / 2 + 0.04)),
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 1.1,
    },
    ctx,
  )

  ctx.statusText = `Flexing the plate: spacers into the tub`
  const spacers = [...printer.plateSpacers]
  printer.plateSpacers.length = 0
  const firstPileIndex = world.tubSpacers.length
  yield* runInParallel([
    pourSpacers(
      {
        spacers,
        container: tub,
        size: SPACER_TUB,
        firstPileIndex,
        durationSeconds: 1.6,
      },
      ctx,
    ),
    tween({
      durationSeconds: 1.6,
      onProgress: (progress) => {
        printer.plate.rotation.x = -Math.sin(Math.PI * progress) * 0.25
      },
    }),
  ])
  world.tubSpacers.push(...spacers)

  ctx.statusText = `Plate back in the ${printer.model}, next print started`
  yield* moveObject(
    {
      object: printer.plate,
      hand: operator.rightHand,
      parent: printer.group,
      localPosition: printer.plateHome,
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 1,
    },
    ctx,
  )
  yield* releaseHand(operator.rightHand)
  yield* grabObject({
    hand: operator.leftHand,
    object: printer.doorHandle,
    fingerCurl: 0.8,
    durationSeconds: 0.6,
  })
  yield* tween({
    durationSeconds: 0.9,
    onProgress: (progress) => {
      printer.door.rotation.y = DOOR_OPEN_CCW_YAW_RADIANS * (1 - progress)
    },
  })
  yield* releaseHand(operator.leftHand)
  printer.isPrinting = true
  printer.printedSeconds = 0
  printer.statusLight.material.color.setHex(PRINTER_STATUS_COLORS.printing)
  ctx.cameraHint = null
}

/** Empty every finished printer plate into a spacer tub, restart the prints, and pick the tub up. */
export function* collectFinishedPlates(ctx: SimContext): SimTask {
  const { world } = ctx
  const tub = world.carriedTub ?? world.emptyTubs.at(-1)
  if (!tub) {
    ctx.statusText = "No empty spacer tub on the printer bench"
    return
  }
  ctx.progress.isOperatorBusy = true
  for (const printer of getFinishedPrinters(ctx))
    yield* collectPlate({ printer, tub }, ctx)

  if (!world.carriedTub) {
    world.emptyTubs.pop()
    world.carriedTub = tub
    ctx.statusText = `Picking up the tub of ${world.tubSpacers.length} spacers`
    yield* pickUpInFront(
      {
        item: tub,
        leftGrip: getGrip({ container: tub, name: "left_grip" }),
        rightGrip: getGrip({ container: tub, name: "right_grip" }),
      },
      ctx,
    )
  }
  ctx.progress.isOperatorBusy = false
  ctx.statusText = `Carrying ${world.tubSpacers.length} spacers. Take them to the assembly bench.`
}

/** Pour the carried tub into the assembly bench's spacer basket and set the empty tub down. */
export function* refillSpacerBasket(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const tub = world.carriedTub
  if (!tub) return
  ctx.progress.isOperatorBusy = true
  yield* walkToStation(STATIONS.assembly, ctx)
  const bench = world.tables.assembly_bench
  ctx.cameraHint = {
    station: STATIONS.assembly,
    view: { azimuthRadians: 1.3, elevationRadians: 0.8, distanceM: 0.8 },
    getFocusPoint: () =>
      bench.localToWorld(
        ASSEMBLY_BENCH_SPOTS.spacerBasket.clone().add(new Vector3(0, 0.08, 0)),
      ),
  }
  const room =
    getSpacerCapacity(ASSEMBLY_SPACER_BASKET) - world.spacerStock.length
  const pouring = world.tubSpacers.splice(0, Math.max(0, room))
  ctx.statusText = `Refilling the spacer basket with ${pouring.length} spacers`
  yield* moveObject(
    {
      object: tub,
      hand: operator.rightHand,
      parent: bench,
      localPosition: ASSEMBLY_BENCH_SPOTS.spacerBasket
        .clone()
        .add(new Vector3(0.08, 0.2, -0.08)),
      localQuaternion: IDENTITY_QUATERNION.clone().setFromAxisAngle(
        new Vector3(1, 0, 0),
        0.5,
      ),
      durationSeconds: 1,
    },
    ctx,
  )
  yield* pourSpacers(
    {
      spacers: pouring,
      container: world.spacerBasket,
      size: ASSEMBLY_SPACER_BASKET,
      firstPileIndex: world.spacerStock.length,
      durationSeconds: 1.8,
    },
    ctx,
  )
  world.spacerStock.push(...pouring)

  ctx.statusText = "Setting the empty tub aside"
  yield* moveObject(
    {
      object: tub,
      hand: operator.rightHand,
      parent: bench,
      localPosition: ASSEMBLY_BENCH_SPOTS.emptyTubs
        .clone()
        .add(new Vector3(0, world.usedTubs.length * TUB_NESTING_M, 0)),
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 1,
      arcHeightM: 0.05,
    },
    ctx,
  )
  yield* runInParallel([
    releaseHand(operator.leftHand),
    releaseHand(operator.rightHand),
  ])
  world.usedTubs.push(tub)
  world.carriedTub = null
  ctx.cameraHint = null
  ctx.progress.isOperatorBusy = false
  ctx.statusText = `Spacer basket refilled: ${world.spacerStock.length} spacers`
}
