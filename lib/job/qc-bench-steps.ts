import { Vector3 } from "three"
import { STATIONS } from "lib/layout/station-layout"
import { getQcFocusPoint } from "lib/job/bench-frames"
import type { JobStep } from "lib/job/job-step"
import { STATUS_LED_COLORS } from "lib/models/controller-pcb"
import { QC_CRADLE } from "lib/models/qc-cradle"
import { QC_DISPLAY_COLORS, type QcDisplayState } from "lib/models/qc-laptop"
import type { SimContext } from "lib/simulation/sim-context"
import {
  runInParallel,
  type SimTask,
  tween,
  waitSeconds,
} from "lib/tasks/coroutines"
import {
  bringHandToCarryPose,
  grabObject,
  holdInHand,
  moveObject,
  reachHand,
  releaseHand,
  trackObjectPoint,
} from "lib/tasks/operator-motions"
import { plugIn, unplug } from "lib/tasks/plug-motions"
import {
  MOTOR_ON_SIDE_QUATERNION,
  PLUG_LYING_QUATERNION,
  QC_BENCH_SPOTS,
} from "lib/world/bench-spots"

/** From beside the operator, so neither the laptop nor the operator blocks the cradle. */
const QC_CLOSE_UP = {
  azimuthRadians: 1.25,
  elevationRadians: 0.9,
  distanceM: 0.6,
}
const SPIN_TEST_SECONDS = 3
const SPIN_TEST_REVOLUTIONS = 9

/** Motor lying in the cradle, back face (PCB) toward +X, mount face just behind the cradle centre. */
const MOTOR_IN_CRADLE_POSITION = QC_BENCH_SPOTS.cradle
  .clone()
  .add(new Vector3(-0.02, QC_CRADLE.motorAxisHeightM, 0))

function setQcDisplay(state: QcDisplayState, ctx: SimContext): void {
  ctx.world.laptop.displayState = state
  ctx.world.laptop.display.material.color.setHex(QC_DISPLAY_COLORS[state])
}

function* seatMotorAndPlugIn(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  ctx.statusText = "Setting the motor in the QC cradle"
  yield* moveObject(
    {
      object: world.motor.group,
      hand: operator.rightHand,
      parent: world.tables.qc_bench,
      localPosition: MOTOR_IN_CRADLE_POSITION,
      localQuaternion: MOTOR_ON_SIDE_QUATERNION,
      durationSeconds: 1,
      arcHeightM: 0.05,
    },
    ctx,
  )
  yield* releaseHand(operator.rightHand)

  ctx.statusText = "Plugging the laptop's USB-C into the data port"
  yield* plugIn(
    {
      plug: world.qcDataCable.plug,
      hand: operator.leftHand,
      port: world.pcb.dataPort,
    },
    ctx,
  )
  ctx.statusText = "Plugging the PD charger's USB-C into the power port"
  yield* plugIn(
    {
      plug: world.qcPowerCable.plug,
      hand: operator.rightHand,
      port: world.pcb.powerPort,
    },
    ctx,
  )
  world.pcb.statusLed.material.color.setHex(STATUS_LED_COLORS.idle)
}

function* runSpinTest(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const hand = operator.rightHand
  ctx.statusText = "Starting the spin test on the laptop"
  yield* reachHand({
    hand,
    getTarget: trackObjectPoint({ object: world.laptop.trackpad }),
    durationSeconds: 0.8,
  })
  hand.targetFingerCurl = 0.5
  yield* waitSeconds(0.25)
  yield* releaseHand(hand)

  ctx.statusText = "Spinning the motor"
  setQcDisplay("testing", ctx)
  world.pcb.statusLed.material.color.setHex(STATUS_LED_COLORS.running)
  const { rotor } = world.motor
  const startRadians = rotor.rotation.y
  yield* tween({
    durationSeconds: SPIN_TEST_SECONDS,
    onProgress: (progress) => {
      rotor.rotation.y =
        startRadians + SPIN_TEST_REVOLUTIONS * Math.PI * 2 * progress
    },
  })
  setQcDisplay("pass", ctx)
  world.pcb.statusLed.material.color.setHex(STATUS_LED_COLORS.idle)
  ctx.statusText = "Spin test passed"
  yield* waitSeconds(0.6)
}

function* unplugAndPickUp(ctx: SimContext): SimTask {
  const { world, operator } = ctx
  const bench = world.tables.qc_bench
  ctx.statusText = "Unplugging both USB-C cables"
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
  world.pcb.statusLed.material.color.setHex(STATUS_LED_COLORS.off)
  setQcDisplay("idle", ctx)

  ctx.statusText = "Taking the tested motor out of the cradle"
  yield* grabObject({
    hand: operator.rightHand,
    object: world.motor.group,
    localGripPoint: new Vector3(0.02, 0.022, 0.02),
    fingerCurl: 0.6,
    durationSeconds: 0.7,
  })
  yield* moveObject(
    {
      object: world.motor.group,
      hand: operator.rightHand,
      parent: bench,
      localPosition: MOTOR_IN_CRADLE_POSITION.clone().add(
        new Vector3(0, 0.05, 0),
      ),
      localQuaternion: MOTOR_ON_SIDE_QUATERNION,
      durationSeconds: 0.5,
    },
    ctx,
  )
  holdInHand({ hand: operator.rightHand, object: world.motor.group })
  yield* bringHandToCarryPose(operator.rightHand, ctx)
}

export const QC_BENCH_STEPS: JobStep[] = [
  {
    label: "Seat motor, plug in 2 USB-C",
    station: STATIONS.qc,
    closeUpView: QC_CLOSE_UP,
    getFocusPoint: getQcFocusPoint,
    run: seatMotorAndPlugIn,
  },
  {
    label: "Run the spin test",
    station: STATIONS.qc,
    closeUpView: { ...QC_CLOSE_UP, distanceM: 0.75 },
    getFocusPoint: getQcFocusPoint,
    run: runSpinTest,
  },
  {
    label: "Unplug, take the motor",
    station: STATIONS.qc,
    closeUpView: QC_CLOSE_UP,
    getFocusPoint: getQcFocusPoint,
    run: unplugAndPickUp,
  },
]
