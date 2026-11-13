import { getTablePoint } from "lib/job/bench-frames"
import { getOccupants, releaseSlot, reserveSlot } from "lib/job/container-slots"
import type { JobStage, JobStep, UnitParams } from "lib/job/job-step"
import {
  countLabelsOnSheets,
  takeNextFromSheets,
  takeNextLabel,
} from "lib/job/label-stock"
import { getCartonFocusPoint, SHIP_CLOSE_UP } from "lib/job/ship-ready-steps"
import { TRANSFER_STEPS } from "lib/job/transfer-steps"
import { STATIONS } from "lib/layout/station-layout"
import { createCoiledJstCable } from "lib/models/coiled-jst-cable"
import { ESD_BAG, type EsdBag, setEsdBagFilled } from "lib/models/esd-bag"
import { createPartKit, type PartKit } from "lib/models/part-kit"
import { createScrewPouch, SCREW_POUCH } from "lib/models/screw-pouch"
import type { OperatorHand } from "lib/operator/create-operator"
import type { SimContext } from "lib/simulation/sim-context"
import { playCue } from "lib/simulation/sound-cues"
import {
  runInParallel,
  type SimTask,
  tween,
  waitSeconds,
} from "lib/tasks/coroutines"
import {
  grabObject,
  liftAndPlace,
  moveObject,
  reachHand,
  releaseHand,
  trackObjectPoint,
} from "lib/tasks/operator-motions"
import {
  BAG_LYING_QUATERNION,
  BAGGING_BENCH_SPOTS,
  IDENTITY_QUATERNION,
} from "lib/world/bench-spots"
import { type AssemblyUnit, setOutLongScrews } from "lib/world/create-world"
import { type Group, type Object3D, Quaternion, Vector3 } from "three"

/** From beside the operator, looking at the bag stand. */
const BAG_CLOSE_UP = {
  azimuthRadians: 1.2,
  elevationRadians: 0.7,
  distanceM: 0.7,
}
const LABEL_PEEL_QUATERNION = new Quaternion().setFromAxisAngle(
  new Vector3(1, 0, 0),
  -0.45,
)
const BAG_ON_STAND_LIFT_M = 0.006
const ZIP_SECONDS = 0.8

function getBag(unit: AssemblyUnit): EsdBag {
  if (!unit.bag) throw new Error("This line has no bag for the unit")
  return unit.bag
}

function getPouchFocusPoint(ctx: SimContext): Vector3 {
  const { pouchFill } = BAGGING_BENCH_SPOTS
  return getTablePoint(
    {
      tableId: "pack_out_bench",
      localPoint: new Vector3(pouchFill.x, pouchFill.y + 0.02, pouchFill.z),
    },
    ctx,
  )
}

function getBagFocusPoint(ctx: SimContext): Vector3 {
  const { bagStand } = BAGGING_BENCH_SPOTS
  return getTablePoint(
    {
      tableId: "pack_out_bench",
      localPoint: new Vector3(bagStand.x, bagStand.y + 0.09, bagStand.z),
    },
    ctx,
  )
}

/** Run a finger along the zip from one end to the other. */
function* slideZipClosed(
  params: { bag: EsdBag; hand: OperatorHand },
  ctx: SimContext,
): SimTask {
  const { bag, hand } = params
  const zipYM = ESD_BAG.heightM - ESD_BAG.zipFromTopM
  const halfWidthM = ESD_BAG.widthM / 2 - 0.01
  let zipProgress = 0
  const getZipPoint = () => {
    bag.group.updateWorldMatrix(true, false)
    return bag.group.localToWorld(
      new Vector3(
        -halfWidthM + 2 * halfWidthM * zipProgress,
        zipYM,
        ESD_BAG.filledDepthM / 2,
      ),
    )
  }
  yield* reachHand({ hand, getTarget: getZipPoint, durationSeconds: 0.5 })
  hand.targetFingerCurl = 1
  playCue("bag_zip", ctx)
  yield* tween({
    durationSeconds: ZIP_SECONDS,
    onProgress: (progress) => {
      zipProgress = progress
    },
  })
}

/** Fill a pink 2" x 3" pouch with the unit's four long screws, zip it and fold it. */
function* fillScrewPouch(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const pouch = createScrewPouch()
  unit.screwPouch = pouch
  const bench = world.tables.pack_out_bench
  // Take the next pouch off the top of the open box.
  bench.add(pouch.group)
  pouch.group.position
    .copy(BAGGING_BENCH_SPOTS.pouchBox)
    .add(new Vector3(0, 0.03, 0))
  ctx.statusText = `Unit ${params.unitIndex + 1}: a pink 2×3 screw pouch from the box`
  yield* grabObject({
    hand: operator.leftHand,
    object: pouch.group,
    localGripPoint: new Vector3(0, 0.002, -0.015),
    fingerCurl: 1,
    durationSeconds: 0.6,
  })
  yield* moveObject(
    {
      object: pouch.group,
      hand: operator.leftHand,
      parent: bench,
      localPosition: BAGGING_BENCH_SPOTS.pouchFill,
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 0.8,
      arcHeightM: 0.05,
    },
    ctx,
  )
  yield* releaseHand(operator.leftHand)
  const screws = setOutLongScrews({
    bin: world.longScrewBin,
    unitIndex: params.unitIndex,
  })
  unit.longScrews = screws
  const hand = operator.rightHand
  for (const [index, screw] of screws.entries()) {
    ctx.statusText = `Unit ${params.unitIndex + 1}: long M3 screw ${index + 1} of 4 into the pouch`
    yield* grabObject({
      hand,
      object: screw,
      fingerCurl: 1,
      durationSeconds: 0.45,
    })
    yield* moveObject(
      {
        object: screw,
        hand,
        parent: pouch.group,
        localPosition: pouch.screwSpots[index].position,
        localQuaternion: pouch.screwSpots[index].quaternion,
        durationSeconds: 0.6,
        arcHeightM: 0.05,
      },
      ctx,
    )
    yield* releaseHand(hand)
    playCue("screw_drop", ctx)
  }
  ctx.statusText = `Unit ${params.unitIndex + 1}: zipping the pouch and folding it over the screws`
  yield* reachHand({
    hand,
    getTarget: trackObjectPoint({
      object: pouch.topFlap,
      localPoint: new Vector3(
        0,
        -SCREW_POUCH.thicknessM,
        -SCREW_POUCH.foldedLengthM + 0.008,
      ),
    }),
    durationSeconds: 0.5,
  })
  playCue("bag_zip", ctx)
  yield* waitSeconds(0.5)
  yield* tween({
    durationSeconds: 0.6,
    onProgress: (progress) => {
      pouch.topFlap.rotation.x = Math.PI * progress
    },
  })
  yield* releaseHand(hand)
}

/** Take a flat outer bag from the tray, stand it on the wire stand and open it. */
function* openBagOnStand(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const bag = getBag(world.units[params.unitIndex])
  ctx.statusText = `Unit ${params.unitIndex + 1}: a 3×5 static-shielding bag from the tray`
  yield* grabObject({
    hand: operator.leftHand,
    object: bag.group,
    localGripPoint: new Vector3(0, ESD_BAG.heightM - 0.02, 0),
    fingerCurl: 0.9,
    durationSeconds: 0.7,
  })
  yield* moveObject(
    {
      object: bag.group,
      hand: operator.leftHand,
      parent: world.tables.pack_out_bench,
      localPosition: BAGGING_BENCH_SPOTS.bagStand
        .clone()
        .add(new Vector3(0, BAG_ON_STAND_LIFT_M, 0)),
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 1,
      arcHeightM: 0.08,
    },
    ctx,
  )
  ctx.statusText = `Unit ${params.unitIndex + 1}: opening the bag on the stand`
  setEsdBagFilled({ bag, isFilled: true })
  yield* tween({
    durationSeconds: 0.35,
    onProgress: (progress) => {
      bag.filledBody.scale.z = 0.15 + 0.85 * progress
    },
  })
  yield* releaseHand(operator.leftHand)
}

/** Lower one part into the open bag onto its place in the bag's contents. */
function* dropIntoBag(
  params: {
    part: Object3D
    contents: PartKit
    spot: Object3D
    gripPoint: Vector3
    label: string
  },
  ctx: SimContext,
): SimTask {
  const hand = ctx.operator.rightHand
  ctx.statusText = params.label
  yield* grabObject({
    hand,
    object: params.part,
    localGripPoint: params.gripPoint,
    fingerCurl: 1,
    durationSeconds: 0.55,
  })
  yield* liftAndPlace(
    {
      object: params.part,
      hand,
      parent: params.contents.group,
      localPosition: params.spot.position,
      localQuaternion: params.spot.quaternion,
      liftHeightM: 0.17,
      travelSeconds: 0.8,
    },
    ctx,
  )
  yield* releaseHand(hand)
}

/** Spacer, then the tested board on it, then the cable and the screw pouch beside them; zip it. */
function* packTheBag(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const bag = getBag(unit)
  const contents = createPartKit()
  unit.kit = contents
  bag.group.add(contents.group)
  contents.group.position.copy(bag.contentsSpot.position)
  contents.group.quaternion.copy(bag.contentsSpot.quaternion)
  const n = params.unitIndex + 1

  const spacer = world.spacerStock.pop()
  if (!spacer) throw new Error("The spacer basket is empty")
  unit.spacer = spacer
  yield* dropIntoBag(
    {
      part: spacer,
      contents,
      spot: contents.spacerSpot,
      gripPoint: new Vector3(0, 0.003, 0.019),
      label: `Unit ${n}: a 4 mm spacer from the basket into the bag`,
    },
    ctx,
  )
  releaseSlot({ container: world.readyRack, unitIndex: params.unitIndex })
  yield* dropIntoBag(
    {
      part: unit.pcb.group,
      contents,
      spot: contents.pcbSpot,
      gripPoint: new Vector3(0, 0.002, 0.02),
      label: `Unit ${n}: the tested board from the passed tray, onto the spacer`,
    },
    ctx,
  )
  const coil = createCoiledJstCable()
  world.cableBin.add(coil)
  coil.position.set(0, 0.022, 0.035)
  contents.cable = coil
  yield* dropIntoBag(
    {
      part: coil,
      contents,
      spot: contents.cableSpot,
      gripPoint: new Vector3(0.022, 0.002, 0),
      label: `Unit ${n}: a coiled motor-to-board cable from the bin`,
    },
    ctx,
  )
  const pouch = unit.screwPouch
  if (!pouch) throw new Error("The screw pouch hasn't been filled")
  contents.screwPouch = pouch.group
  yield* dropIntoBag(
    {
      part: pouch.group,
      contents,
      spot: contents.pouchSpot,
      gripPoint: new Vector3(0, 0.006, 0),
      label: `Unit ${n}: the screw pouch on the cable`,
    },
    ctx,
  )

  ctx.statusText = `Unit ${n}: pressing the zip closed`
  yield* slideZipClosed({ bag, hand: operator.rightHand }, ctx)
  yield* runInParallel([
    releaseHand(operator.leftHand),
    releaseHand(operator.rightHand),
  ])
}

/** Peel a label off its sheet and press it onto a spot on the bag. */
function* peelAndApply(
  params: {
    label: Group
    bag: EsdBag
    spot: { position: Vector3; quaternion: Quaternion }
    hand: OperatorHand
    labelLengthM: number
  },
  ctx: SimContext,
): SimTask {
  const { label, bag, spot, hand } = params
  const sheet = label.parent
  if (!sheet) throw new Error("Label must start on its sheet")
  yield* grabObject({
    hand,
    object: label,
    localGripPoint: new Vector3(0, 0.001, params.labelLengthM / 2 - 0.006),
    fingerCurl: 1,
    durationSeconds: 0.7,
  })
  yield* moveObject(
    {
      object: label,
      hand,
      parent: sheet,
      localPosition: label.position.clone().add(new Vector3(0, 0.04, 0.03)),
      localQuaternion: label.quaternion.clone().multiply(LABEL_PEEL_QUATERNION),
      durationSeconds: 0.5,
    },
    ctx,
  )
  const outward = new Vector3(0, 0.012, 0).applyQuaternion(spot.quaternion)
  yield* moveObject(
    {
      object: label,
      hand,
      parent: bag.group,
      localPosition: spot.position.clone().add(outward),
      localQuaternion: spot.quaternion,
      durationSeconds: 0.9,
      arcHeightM: 0.05,
    },
    ctx,
  )
  yield* moveObject(
    {
      object: label,
      hand,
      parent: bag.group,
      localPosition: spot.position,
      localQuaternion: spot.quaternion,
      durationSeconds: 0.3,
    },
    ctx,
  )
  playCue("label_press", ctx)
  yield* releaseHand(hand)
}

function* applyProductSticker(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const bag = getBag(unit)
  const label = takeNextLabel(world)
  if (!label) throw new Error("No bag stickers left at the bagging bench")
  unit.label = label
  ctx.statusText = `Unit ${params.unitIndex + 1}: tscircuit 2×3 sticker on the front of the bag`
  yield* peelAndApply(
    {
      label,
      bag,
      spot: bag.frontStickerSpot,
      hand: operator.rightHand,
      labelLengthM: 3 * 0.0254,
    },
    ctx,
  )
}

function* applyFnskuLabel(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const bag = getBag(unit)
  const label = takeNextFromSheets(world.fnskuSheets)
  if (!label) throw new Error("No FNSKU labels left at the bagging bench")
  unit.fnskuLabel = label
  ctx.statusText = `Unit ${params.unitIndex + 1}: turning the bag round for the FNSKU label`
  const startYaw = bag.group.rotation.y
  yield* grabObject({
    hand: operator.leftHand,
    object: bag.group,
    localGripPoint: new Vector3(0, ESD_BAG.heightM - 0.02, 0),
    fingerCurl: 0.9,
    durationSeconds: 0.5,
  })
  yield* tween({
    durationSeconds: 0.6,
    onProgress: (progress) => {
      bag.group.rotation.y = startYaw + Math.PI * progress
    },
  })
  ctx.statusText = `Unit ${params.unitIndex + 1}: Amazon FNSKU label on the back, the only barcode on the bag`
  yield* peelAndApply(
    {
      label,
      bag,
      spot: bag.backLabelSpot,
      hand: operator.rightHand,
      labelLengthM: 2.625 * 0.0254,
    },
    ctx,
  )
  yield* releaseHand(operator.leftHand)
}

/** The tote holds bags lying flat, front up, in the kit's mailer slots. */
const BAG_IN_TOTE_OFFSET = new Vector3(
  0,
  ESD_BAG.filledDepthM / 2,
  ESD_BAG.heightM / 2,
)

function* bagIntoTote(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const bag = getBag(unit)
  const hand = operator.rightHand
  const slotIndex = reserveSlot({
    container: world.packingTote,
    unitIndex: params.unitIndex,
  })
  ctx.statusText = `Unit ${params.unitIndex + 1}: bagged unit into the tote`
  yield* grabObject({
    hand,
    object: bag.group,
    localGripPoint: new Vector3(0, ESD_BAG.heightM - 0.01, 0),
    fingerCurl: 0.9,
    durationSeconds: 0.6,
  })
  yield* liftAndPlace(
    {
      object: bag.group,
      hand,
      parent: world.packingTote.group,
      localPosition: world.packingTote.slots[slotIndex].position
        .clone()
        .add(BAG_IN_TOTE_OFFSET),
      localQuaternion: BAG_LYING_QUATERNION,
      liftHeightM: 0.08,
      travelSeconds: 0.9,
    },
    ctx,
  )
  yield* releaseHand(hand)
}

const hasStickers = (_params: UnitParams, ctx: SimContext) =>
  countLabelsOnSheets(ctx.world.labelSheets) > 0
    ? null
    : "No bag stickers left. Collect printed sheets from the label printer."
const hasFnskuLabels = (_params: UnitParams, ctx: SimContext) =>
  countLabelsOnSheets(ctx.world.fnskuSheets) > 0
    ? null
    : "No FNSKU labels left. Print more from Seller Central."

/** Pack-out for the bare unit: ESD bag, product sticker, FNSKU label, tote. */
export const BAGGING_STAGE: JobStage = {
  label: "Bagging",
  isPerUnit: true,
  steps: [
    {
      label: "4 screws into a pink pouch, fold it",
      station: STATIONS.packOut,
      closeUpView: { ...BAG_CLOSE_UP, azimuthRadians: 1.6, distanceM: 0.6 },
      getFocusPoint: (_params, ctx) => getPouchFocusPoint(ctx),
      run: fillScrewPouch,
    },
    {
      label: "Open a 3×5 ESD bag on the stand",
      station: STATIONS.packOut,
      closeUpView: BAG_CLOSE_UP,
      getFocusPoint: (_params, ctx) => getBagFocusPoint(ctx),
      run: openBagOnStand,
    },
    {
      label: "Spacer, board, cable, screw pouch in; zip",
      station: STATIONS.packOut,
      closeUpView: BAG_CLOSE_UP,
      getFocusPoint: (_params, ctx) => getBagFocusPoint(ctx),
      run: packTheBag,
      getBlocker: (_params, ctx) =>
        ctx.world.spacerStock.length > 0
          ? null
          : "The spacer basket is empty. Collect prints from the 3D printers and refill it.",
    },
    {
      label: "tscircuit sticker on the front",
      station: STATIONS.packOut,
      closeUpView: { ...BAG_CLOSE_UP, distanceM: 0.9 },
      getFocusPoint: (_params, ctx) => getBagFocusPoint(ctx),
      run: applyProductSticker,
      getBlocker: hasStickers,
    },
    {
      label: "FNSKU label on the back",
      station: STATIONS.packOut,
      closeUpView: { ...BAG_CLOSE_UP, distanceM: 0.9 },
      getFocusPoint: (_params, ctx) => getBagFocusPoint(ctx),
      run: applyFnskuLabel,
      getBlocker: hasFnskuLabels,
    },
    {
      label: "Bagged unit into the tote",
      station: STATIONS.packOutLabels,
      closeUpView: { ...BAG_CLOSE_UP, distanceM: 1.1 },
      getFocusPoint: (_params, ctx) => getBagFocusPoint(ctx),
      run: bagIntoTote,
    },
  ],
}

function* loadBagIntoCarton(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const bag = getBag(unit)
  const hand = operator.rightHand
  releaseSlot({ container: world.packingTote, unitIndex: params.unitIndex })
  const slotIndex = reserveSlot({
    container: world.carton,
    unitIndex: params.unitIndex,
  })
  ctx.statusText = `Bag ${slotIndex + 1} of ${world.carton.slots.length} standing into the FBA carton`
  yield* grabObject({
    hand,
    object: bag.group,
    localGripPoint: new Vector3(0, ESD_BAG.heightM - 0.01, -0.02),
    fingerCurl: 0.9,
    durationSeconds: 0.6,
  })
  yield* liftAndPlace(
    {
      object: bag.group,
      hand,
      parent: world.carton.group,
      localPosition: world.carton.slots[slotIndex].position,
      localQuaternion: IDENTITY_QUATERNION,
      liftHeightM: 0.2,
      travelSeconds: 0.8,
    },
    ctx,
  )
  yield* releaseHand(hand)
}

export const LOAD_BAG_CARTON_STAGE: JobStage = {
  label: "Ship-ready",
  isPerUnit: true,
  steps: [
    {
      label: "Bag into the FBA carton",
      station: STATIONS.shipReady,
      closeUpView: SHIP_CLOSE_UP,
      getFocusPoint: (_params, ctx) => getCartonFocusPoint(ctx),
      run: loadBagIntoCarton,
    },
  ],
}

/** FBA box ID label on the carton's side, then fold, tape and ship as usual. */
function* labelSealAndShip(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const label = world.boxIdLabel
  if (label) {
    ctx.statusText = `FBA box ID label on the side: ${getOccupants(world.carton).length} units in this box`
    yield* reachHand({
      hand: operator.rightHand,
      getTarget: trackObjectPoint({ object: label }),
      durationSeconds: 0.6,
    })
    label.visible = true
    playCue("label_press", ctx)
    yield* waitSeconds(0.4)
    yield* releaseHand(operator.rightHand)
  }
  yield* TRANSFER_STEPS.sealAndShip.run(params, ctx)
}

export const LABEL_SEAL_AND_SHIP_STEP: JobStep = {
  ...TRANSFER_STEPS.sealAndShip,
  label: "Box ID label, seal the carton, out to ship",
  run: labelSealAndShip,
}
