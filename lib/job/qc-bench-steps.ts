import { getQcFocusPoint } from "lib/job/bench-frames"
import { releaseSlot, reserveSlot } from "lib/job/container-slots"
import type { JobStage, UnitParams } from "lib/job/job-step"
import { MOTOR_IN_CRADLE_POSITION } from "lib/job/unit-poses"
import { STATIONS } from "lib/layout/station-layout"
import { STATUS_LED_COLORS } from "lib/models/controller-pcb"
import { QC_DISPLAY_COLORS, type QcDisplayState } from "lib/models/qc-laptop"
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
import { plugIn, unplug } from "lib/tasks/plug-motions"
import {
  IDENTITY_QUATERNION,
  MOTOR_ON_SIDE_QUATERNION,
  PLUG_LYING_QUATERNION,
  QC_BENCH_SPOTS,
} from "lib/world/bench-spots"
import { Vector3 } from "three"

/** From beside the operator, so neither the laptop nor the operator blocks the cradle. */
const QC_CLOSE_UP = {
  azimuthRadians: 1.25,
  elevationRadians: 0.9,
  distanceM: 0.65,
}
const SPIN_TEST_SECONDS = 3
const SPIN_TEST_REVOLUTIONS = 9

function setQcDisplay(state: QcDisplayState, ctx: SimContext): void {
  ctx.world.laptop.displayState = state
  ctx.world.laptop.display.material.color.setHex(QC_DISPLAY_COLORS[state])
}

function* seatMotorAndPlugIn(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  releaseSlot({ container: world.finishedRack, unitIndex: params.unitIndex })
  ctx.statusText = `Unit ${params.unitIndex + 1}: taking it from the rack into the QC cradle`
  yield* grabObject({
    hand: operator.rightHand,
    object: unit.motor.group,
    localGripPoint: new Vector3(0, 0.03, 0.021),
    fingerCurl: 0.6,
    durationSeconds: 0.7,
  })
  yield* moveObject(
    {
      object: unit.motor.group,
      hand: operator.rightHand,
      parent: world.tables.qc_bench,
      localPosition: MOTOR_IN_CRADLE_POSITION,
      localQuaternion: MOTOR_ON_SIDE_QUATERNION,
      durationSeconds: 1.1,
      arcHeightM: 0.08,
    },
    ctx,
  )
  yield* releaseHand(operator.rightHand)

  ctx.statusText = `Unit ${params.unitIndex + 1}: plugging the laptop's USB-C into the data port`
  yield* plugIn(
    {
      plug: world.qcDataCable.plug,
      hand: operator.leftHand,
      port: unit.pcb.dataPort,
    },
    ctx,
  )
  ctx.statusText = `Unit ${params.unitIndex + 1}: plugging the charging station's USB-C into the power port`
  yield* plugIn(
    {
      plug: world.qcPowerCable.plug,
      hand: operator.rightHand,
      port: unit.pcb.powerPort,
    },
    ctx,
  )
  unit.pcb.statusLed.material.color.setHex(STATUS_LED_COLORS.idle)
  // The RP2040's buzzer (BZ1) chirps when the QC firmware comes up.
  playCue("board_chirp", ctx)
}

function* runSpinTest(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const hand = operator.rightHand
  ctx.statusText = `Unit ${params.unitIndex + 1}: starting the spin test on the laptop`
  yield* reachHand({
    hand,
    getTarget: trackObjectPoint({ object: world.laptop.trackpad }),
    durationSeconds: 0.8,
  })
  hand.targetFingerCurl = 0.5
  yield* waitSeconds(0.25)
  yield* releaseHand(hand)

  ctx.statusText = `Unit ${params.unitIndex + 1}: spinning the motor`
  setQcDisplay("testing", ctx)
  unit.pcb.statusLed.material.color.setHex(STATUS_LED_COLORS.running)
  const { rotor } = unit.motor
  const startRadians = rotor.rotation.y
  yield* tween({
    durationSeconds: SPIN_TEST_SECONDS,
    onProgress: (progress) => {
      rotor.rotation.y =
        startRadians + SPIN_TEST_REVOLUTIONS * Math.PI * 2 * progress
    },
  })
  setQcDisplay("pass", ctx)
  playCue("qc_pass", ctx)
  unit.pcb.statusLed.material.color.setHex(STATUS_LED_COLORS.idle)
  ctx.statusText = `Unit ${params.unitIndex + 1}: spin test passed`
  yield* waitSeconds(0.5)
}

function* unplugAndRack(params: UnitParams, ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const unit = world.units[params.unitIndex]
  const bench = world.tables.qc_bench
  ctx.statusText = `Unit ${params.unitIndex + 1}: unplugging both USB-C cables`
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
  unit.pcb.statusLed.material.color.setHex(STATUS_LED_COLORS.off)
  setQcDisplay("idle", ctx)

  const slotIndex = reserveSlot({
    container: world.readyRack,
    unitIndex: params.unitIndex,
  })
  ctx.statusText = `Unit ${params.unitIndex + 1}: tested, into the ready rack`
  yield* grabObject({
    hand: operator.rightHand,
    object: unit.motor.group,
    localGripPoint: new Vector3(0.02, 0.022, 0.02),
    fingerCurl: 0.6,
    durationSeconds: 0.6,
  })
  yield* liftAndPlace(
    {
      object: unit.motor.group,
      hand: operator.rightHand,
      parent: world.readyRack.group,
      localPosition: world.readyRack.slots[slotIndex].position,
      localQuaternion: IDENTITY_QUATERNION,
      liftHeightM: 0.07,
      travelSeconds: 0.9,
    },
    ctx,
  )
  yield* releaseHand(operator.rightHand)
}

export const QC_STAGE: JobStage = {
  label: "QC",
  isPerUnit: true,
  steps: [
    {
      label: "Seat motor, plug in 2 USB-C",
      station: STATIONS.qc,
      closeUpView: QC_CLOSE_UP,
      getFocusPoint: (_params, ctx) => getQcFocusPoint(ctx),
      run: seatMotorAndPlugIn,
    },
    {
      label: "Run the spin test",
      station: STATIONS.qc,
      closeUpView: { ...QC_CLOSE_UP, distanceM: 0.8 },
      getFocusPoint: (_params, ctx) => getQcFocusPoint(ctx),
      run: runSpinTest,
    },
    {
      label: "Unplug, into the ready rack",
      station: STATIONS.qc,
      closeUpView: { ...QC_CLOSE_UP, distanceM: 0.9 },
      getFocusPoint: (_params, ctx) => getQcFocusPoint(ctx),
      run: unplugAndRack,
    },
  ],
}
