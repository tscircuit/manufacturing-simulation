import { getJigFocusPoint, getQcFocusPoint } from "lib/job/bench-frames"
import { releaseSlot, reserveSlot } from "lib/job/container-slots"
import type { JobStage, UnitParams } from "lib/job/job-step"
import { setQcDisplay, spinTestOnMotor } from "lib/job/qc-bench-steps"
import { PCB_ON_MOTOR } from "lib/job/unit-poses"
import { STATIONS } from "lib/layout/station-layout"
import { createCoiledJstCable } from "lib/models/coiled-jst-cable"
import { STATUS_LED_COLORS } from "lib/models/controller-pcb"
import { createPartKit, type PartKit } from "lib/models/part-kit"
import type { SimContext } from "lib/simulation/sim-context"
import { playCue } from "lib/simulation/sound-cues"
import { runInParallel, type SimTask, waitSeconds } from "lib/tasks/coroutines"
import {
  grabObject,
  liftAndPlace,
  moveObject,
  releaseHand,
} from "lib/tasks/operator-motions"
import { plugIn, unplug } from "lib/tasks/plug-motions"
import {
  ASSEMBLY_BENCH_SPOTS,
  IDENTITY_QUATERNION,
  PLUG_LYING_QUATERNION,
  QC_BENCH_SPOTS,
} from "lib/world/bench-spots"
import {
  type AssemblyUnit,
  QC_TEST_PLUG_REST,
  setOutLongScrews,
} from "lib/world/create-world"
import { type Object3D, Vector3 } from "three"

/** Looking over the jig, where each kit is gathered. */
const KIT_CLOSE_UP = {
  azimuthRadians: 2.5,
  elevationRadians: 0.75,
  distanceM: 0.8,
}
const QC_CLOSE_UP = {
  azimuthRadians: 1.25,
  elevationRadians: 0.9,
  distanceM: 0.7,
}

function getKit(unit: AssemblyUnit): PartKit {
  if (!unit.kit) throw new Error("This unit hasn't been kitted yet")
  return unit.kit
}

/** Move a part from wherever it is onto a spot in the kit, with one hand. */
function* placeInKit(
  params: {
    part: Object3D
    kit: PartKit
    spot: Object3D
    gripPoint: Vector3
    hand: "left" | "right"
  },
  ctx: SimContext,
): SimTask {
  const hand =
    params.hand === "left" ? ctx.operator.leftHand : ctx.operator.rightHand
  yield* grabObject({
    hand,
    object: params.part,
    localGripPoint: params.gripPoint,
    fingerCurl: 1,
    durationSeconds: 0.6,
  })
  yield* moveObject(
    {
      object: params.part,
      hand,
      parent: params.kit.group,
      localPosition: params.spot.position,
      localQuaternion: params.spot.quaternion,
      durationSeconds: 0.8,
      arcHeightM: 0.06,
    },
    ctx,
  )
  // Remember where it sits, so the kit can be re-laid out in the bag.
  params.kit.placed = params.kit.placed.filter(
    (entry) => entry.part !== params.part,
  )
  params.kit.placed.push({ part: params.part, spot: params.spot })
  yield* releaseHand(hand)
}

/** Start a kit on the jig and lay a spacer from the basket in it. */
function* startKitWithSpacer(params: UnitParams, ctx: SimContext): SimTask {
  const { world } = ctx
  const unit = world.units[params.unitIndex]
  releaseSlot({ container: world.motorFoamStand, unitIndex: params.unitIndex })
  const kit = createPartKit()
  world.tables.assembly_bench.add(kit.group)
  kit.group.position.copy(ASSEMBLY_BENCH_SPOTS.jigTop)
  unit.kit = kit
  const spacer = world.spacerStock.pop()
  if (!spacer) throw new Error("The spacer basket is empty")
  unit.spacer = spacer
  ctx.statusText = `Kit ${params.unitIndex + 1}: a 4 mm spacer from the basket`
  yield* placeInKit(
    {
      part: spacer,
      kit,
      spot: kit.spacerSpot,
      gripPoint: new Vector3(0, 0.003, 0.019),
      hand: "right",
    },
    ctx,
  )
}

function* addBoard(params: UnitParams, ctx: SimContext): SimTask {
  const unit = ctx.world.units[params.unitIndex]
  const kit = getKit(unit)
  ctx.statusText = `Kit ${params.unitIndex + 1}: a controller board from the stack`
  yield* placeInKit(
    {
      part: unit.pcb.group,
      kit,
      spot: kit.pcbSpot,
      gripPoint: new Vector3(0, 0.002, 0.02),
      hand: "left",
    },
    ctx,
  )
}

function* addLongScrews(params: UnitParams, ctx: SimContext): SimTask {
  const { world } = ctx
  const unit = world.units[params.unitIndex]
  const kit = getKit(unit)
  const screws = setOutLongScrews({
    bin: world.longScrewBin,
    unitIndex: params.unitIndex,
  })
  unit.longScrews = screws
  // A small pink anti-static pouch keeps the screws off the board.
  kit.group.add(kit.screwPouch)
  kit.screwPouch.position.copy(kit.pouchSpot.position)
  kit.placed.push({ part: kit.screwPouch, spot: kit.pouchSpot })
  const hand = ctx.operator.rightHand
  for (const [index, screw] of screws.entries()) {
    ctx.statusText = `Kit ${params.unitIndex + 1}: long M3 screw ${index + 1} of 4 into the screw pouch`
    yield* grabObject({
      hand,
      object: screw,
      fingerCurl: 1,
      durationSeconds: 0.5,
    })
    yield* moveObject(
      {
        object: screw,
        hand,
        parent: kit.screwPouch,
        localPosition: kit.screwSpots[index].position,
        localQuaternion: kit.screwSpots[index].quaternion,
        durationSeconds: 0.7,
        arcHeightM: 0.05,
      },
      ctx,
    )
    yield* releaseHand(hand)
    playCue("screw_drop", ctx)
  }
  ctx.statusText = `Kit ${params.unitIndex + 1}: zipping the screw pouch`
  playCue("bag_zip", ctx)
  yield* waitSeconds(0.6)
}

function* addMotorCable(params: UnitParams, ctx: SimContext): SimTask {
  const { world } = ctx
  const unit = world.units[params.unitIndex]
  const kit = getKit(unit)
  const coil = createCoiledJstCable()
  world.cableBin.add(coil)
  coil.position.set(0, 0.022, 0.035)
  kit.cable = coil
  ctx.statusText = `Kit ${params.unitIndex + 1}: a coiled motor-to-board cable from the bin`
  yield* placeInKit(
    {
      part: coil,
      kit,
      spot: kit.cableSpot,
      gripPoint: new Vector3(0.022, 0.002, 0),
      hand: "left",
    },
    ctx,
  )
}

function* kitIntoRack(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const kit = getKit(world.units[params.unitIndex])
  const slotIndex = reserveSlot({
    container: world.finishedRack,
    unitIndex: params.unitIndex,
  })
  ctx.statusText = `Kit ${params.unitIndex + 1}: into the rack`
  yield* grabObject({
    hand: operator.rightHand,
    object: kit.group,
    localGripPoint: new Vector3(0, 0.006, 0.02),
    fingerCurl: 0.8,
    durationSeconds: 0.6,
  })
  yield* liftAndPlace(
    {
      object: kit.group,
      hand: operator.rightHand,
      parent: world.finishedRack.group,
      localPosition: world.finishedRack.slots[slotIndex].position,
      localQuaternion: IDENTITY_QUATERNION,
      liftHeightM: 0.06,
      travelSeconds: 0.9,
    },
    ctx,
  )
  yield* releaseHand(operator.rightHand)
}

/** The assembly bench without motors: each unit's parts are gathered into a kit and racked. */
export const KITTING_STAGE: JobStage = {
  label: "Kitting",
  isPerUnit: true,
  steps: [
    {
      label: "Start a kit: spacer from the basket",
      station: STATIONS.assembly,
      closeUpView: KIT_CLOSE_UP,
      getFocusPoint: (_params, ctx) => getJigFocusPoint(ctx),
      run: startKitWithSpacer,
      getBlocker: (_params, ctx) =>
        ctx.world.spacerStock.length > 0
          ? null
          : "The spacer basket is empty. Collect prints from the 3D printers and refill it.",
    },
    {
      label: "Controller board from the stack",
      station: STATIONS.assembly,
      closeUpView: KIT_CLOSE_UP,
      getFocusPoint: (_params, ctx) => getJigFocusPoint(ctx),
      run: addBoard,
    },
    {
      label: "4 long M3 screws into a pouch",
      station: STATIONS.assembly,
      closeUpView: KIT_CLOSE_UP,
      getFocusPoint: (_params, ctx) => getJigFocusPoint(ctx),
      run: addLongScrews,
    },
    {
      label: "Motor-to-board cable from the bin",
      station: STATIONS.assembly,
      closeUpView: KIT_CLOSE_UP,
      getFocusPoint: (_params, ctx) => getJigFocusPoint(ctx),
      run: addMotorCable,
    },
    {
      label: "Kit into the rack",
      station: STATIONS.assembly,
      closeUpView: { ...KIT_CLOSE_UP, distanceM: 1.1 },
      getFocusPoint: (_params, ctx) => getJigFocusPoint(ctx),
      run: kitIntoRack,
    },
  ],
}

function getTestFixture(ctx: SimContext) {
  const { testMotor, testMotorCable } = ctx.world
  if (!testMotor || !testMotorCable)
    throw new Error("This line has no test motor at QC")
  return { testMotor, testMotorCable }
}

/** Board out of its kit onto the test motor's back face, then the motor cable and both USB-C. */
function* mountBoardOnTestMotor(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const { testMotor, testMotorCable } = getTestFixture(ctx)
  ctx.statusText = `Board ${params.unitIndex + 1}: onto the test motor's back face`
  yield* grabObject({
    hand: operator.leftHand,
    object: unit.pcb.group,
    localGripPoint: new Vector3(0, 0.002, 0.02),
    fingerCurl: 1,
    durationSeconds: 0.7,
  })
  yield* moveObject(
    {
      object: unit.pcb.group,
      hand: operator.leftHand,
      parent: testMotor.group,
      localPosition: PCB_ON_MOTOR,
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 1.1,
      arcHeightM: 0.07,
    },
    ctx,
  )
  yield* releaseHand(operator.leftHand)
  ctx.statusText = `Board ${params.unitIndex + 1}: the test motor's cable into J1`
  yield* plugIn(
    {
      plug: testMotorCable.boardPlug,
      hand: operator.rightHand,
      port: unit.pcb.motorHeader,
    },
    ctx,
  )
  ctx.statusText = `Board ${params.unitIndex + 1}: laptop USB-C into DATA`
  yield* plugIn(
    {
      plug: world.qcDataCable.plug,
      hand: operator.leftHand,
      port: unit.pcb.dataPort,
    },
    ctx,
  )
  ctx.statusText = `Board ${params.unitIndex + 1}: charging station USB-C into PWR`
  yield* plugIn(
    {
      plug: world.qcPowerCable.plug,
      hand: operator.rightHand,
      port: unit.pcb.powerPort,
    },
    ctx,
  )
  unit.pcb.statusLed.material.color.setHex(STATUS_LED_COLORS.idle)
  playCue("board_chirp", ctx)
}

function* spinTestMotor(params: UnitParams, ctx: SimContext): SimTask {
  const unit = ctx.world.units[params.unitIndex]
  const { testMotor } = getTestFixture(ctx)
  yield* spinTestOnMotor(
    { unitIndex: params.unitIndex, motor: testMotor, pcb: unit.pcb },
    ctx,
  )
}

/** Unplug everything, put the board back in its kit, and move the kit to the ready rack. */
function* unplugAndRackKit(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const kit = getKit(unit)
  const { testMotorCable } = getTestFixture(ctx)
  const bench = world.tables.qc_bench
  ctx.statusText = `Board ${params.unitIndex + 1}: unplugging the USB-C and motor cables`
  yield* runInParallel([
    unplug(
      {
        plug: world.qcDataCable.plug,
        hand: operator.leftHand,
        restParent: bench,
        restPosition: QC_BENCH_SPOTS.dataPlugRest,
        restQuaternion: PLUG_LYING_QUATERNION,
      },
      ctx,
    ),
    unplug(
      {
        plug: world.qcPowerCable.plug,
        hand: operator.rightHand,
        restParent: bench,
        restPosition: QC_BENCH_SPOTS.powerPlugRest,
        restQuaternion: PLUG_LYING_QUATERNION,
      },
      ctx,
    ),
  ])
  yield* unplug(
    {
      plug: testMotorCable.boardPlug,
      hand: operator.rightHand,
      restParent: bench,
      restPosition: QC_TEST_PLUG_REST,
      restQuaternion: PLUG_LYING_QUATERNION,
    },
    ctx,
  )
  unit.pcb.statusLed.material.color.setHex(STATUS_LED_COLORS.off)
  setQcDisplay("idle", ctx)

  ctx.statusText = `Board ${params.unitIndex + 1}: tested, back into its kit`
  yield* placeInKit(
    {
      part: unit.pcb.group,
      kit,
      spot: kit.pcbSpot,
      gripPoint: new Vector3(0, 0.002, 0.02),
      hand: "left",
    },
    ctx,
  )
  releaseSlot({ container: world.finishedRack, unitIndex: params.unitIndex })
  const slotIndex = reserveSlot({
    container: world.readyRack,
    unitIndex: params.unitIndex,
  })
  ctx.statusText = `Kit ${params.unitIndex + 1}: into the ready rack`
  yield* grabObject({
    hand: operator.rightHand,
    object: kit.group,
    localGripPoint: new Vector3(0, 0.006, 0.02),
    fingerCurl: 0.8,
    durationSeconds: 0.6,
  })
  yield* liftAndPlace(
    {
      object: kit.group,
      hand: operator.rightHand,
      parent: world.readyRack.group,
      localPosition: world.readyRack.slots[slotIndex].position,
      localQuaternion: IDENTITY_QUATERNION,
      liftHeightM: 0.06,
      travelSeconds: 0.9,
    },
    ctx,
  )
  yield* releaseHand(operator.rightHand)
  yield* waitSeconds(0.1)
}

/** QC with the one test motor: every board spins it before it's bagged. */
export const TEST_MOTOR_QC_STAGE: JobStage = {
  label: "QC",
  isPerUnit: true,
  steps: [
    {
      label: "Board onto the test motor, plug in",
      station: STATIONS.qc,
      closeUpView: QC_CLOSE_UP,
      getFocusPoint: (_params, ctx) => getQcFocusPoint(ctx),
      run: mountBoardOnTestMotor,
    },
    {
      label: "Spin the test motor",
      station: STATIONS.qc,
      closeUpView: { ...QC_CLOSE_UP, distanceM: 0.85 },
      getFocusPoint: (_params, ctx) => getQcFocusPoint(ctx),
      run: spinTestMotor,
    },
    {
      label: "Unplug, kit to the ready rack",
      station: STATIONS.qc,
      closeUpView: { ...QC_CLOSE_UP, distanceM: 0.95 },
      getFocusPoint: (_params, ctx) => getQcFocusPoint(ctx),
      run: unplugAndRackKit,
    },
  ],
}
