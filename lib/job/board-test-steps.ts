import { getQcFocusPoint } from "lib/job/bench-frames"
import { releaseSlot, reserveSlot } from "lib/job/container-slots"
import type { JobStage, UnitParams } from "lib/job/job-step"
import { setQcDisplay, spinTestOnMotor } from "lib/job/qc-bench-steps"
import { STATIONS } from "lib/layout/station-layout"
import { STATUS_LED_COLORS } from "lib/models/controller-pcb"
import type { SimContext } from "lib/simulation/sim-context"
import { playCue } from "lib/simulation/sound-cues"
import { runInParallel, type SimTask } from "lib/tasks/coroutines"
import {
  grabObject,
  liftAndPlace,
  moveObject,
  releaseHand,
} from "lib/tasks/operator-motions"
import { plugIn, unplug } from "lib/tasks/plug-motions"
import {
  IDENTITY_QUATERNION,
  PLUG_LYING_QUATERNION,
  QC_BENCH_SPOTS,
} from "lib/world/bench-spots"
import { BOARD_TEST_SPOT, QC_TEST_PLUG_REST } from "lib/world/create-world"
import { Vector3 } from "three"

const QC_CLOSE_UP = {
  azimuthRadians: 1.25,
  elevationRadians: 0.9,
  distanceM: 0.7,
}
const BOARD_GRIP = new Vector3(0, 0.002, 0.02)

function getTestFixture(ctx: SimContext) {
  const { testMotor, testMotorCable } = ctx.world
  if (!testMotor || !testMotorCable)
    throw new Error("This line has no test motor at QC")
  return { testMotor, testMotorCable }
}

/** Board from the untested tray onto the mat beside the test motor (not screwed on), then plug in. */
function* boardBesideTestMotor(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const { testMotorCable } = getTestFixture(ctx)
  releaseSlot({ container: world.finishedRack, unitIndex: params.unitIndex })
  ctx.statusText = `Board ${params.unitIndex + 1}: from the untested tray onto the test mat`
  yield* grabObject({
    hand: operator.leftHand,
    object: unit.pcb.group,
    localGripPoint: BOARD_GRIP,
    fingerCurl: 1,
    durationSeconds: 0.7,
  })
  yield* moveObject(
    {
      object: unit.pcb.group,
      hand: operator.leftHand,
      parent: world.tables.qc_bench,
      localPosition: BOARD_TEST_SPOT,
      localQuaternion: IDENTITY_QUATERNION,
      durationSeconds: 1,
      arcHeightM: 0.07,
    },
    ctx,
  )
  yield* releaseHand(operator.leftHand)
  ctx.statusText = `Board ${params.unitIndex + 1}: test motor's cable into J1`
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

/** Unplug the three cables and put the board that passed in the passed tray. */
function* unplugIntoPassedTray(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const { testMotorCable } = getTestFixture(ctx)
  const bench = world.tables.qc_bench
  ctx.statusText = `Board ${params.unitIndex + 1}: unplugging USB-C and the motor cable`
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
  const slotIndex = reserveSlot({
    container: world.readyRack,
    unitIndex: params.unitIndex,
  })
  ctx.statusText = `Board ${params.unitIndex + 1}: passed, into the passed tray`
  yield* grabObject({
    hand: operator.leftHand,
    object: unit.pcb.group,
    localGripPoint: BOARD_GRIP,
    fingerCurl: 1,
    durationSeconds: 0.6,
  })
  yield* liftAndPlace(
    {
      object: unit.pcb.group,
      hand: operator.leftHand,
      parent: world.readyRack.group,
      localPosition: world.readyRack.slots[slotIndex].position,
      localQuaternion: IDENTITY_QUATERNION,
      liftHeightM: 0.05,
      travelSeconds: 0.9,
    },
    ctx,
  )
  yield* releaseHand(operator.leftHand)
}

/** Bare-unit QC: every board spins the one test motor, never screwed to it. */
export const BOARD_TEST_STAGE: JobStage = {
  label: "QC",
  isPerUnit: true,
  steps: [
    {
      label: "Board beside the test motor, plug in 3 cables",
      station: STATIONS.qc,
      closeUpView: QC_CLOSE_UP,
      getFocusPoint: (_params, ctx) => getQcFocusPoint(ctx),
      run: boardBesideTestMotor,
    },
    {
      label: "Spin the test motor",
      station: STATIONS.qc,
      closeUpView: { ...QC_CLOSE_UP, distanceM: 0.85 },
      getFocusPoint: (_params, ctx) => getQcFocusPoint(ctx),
      run: spinTestMotor,
    },
    {
      label: "Unplug, into the passed tray",
      station: STATIONS.qc,
      closeUpView: { ...QC_CLOSE_UP, distanceM: 0.95 },
      getFocusPoint: (_params, ctx) => getQcFocusPoint(ctx),
      run: unplugIntoPassedTray,
    },
  ],
}
