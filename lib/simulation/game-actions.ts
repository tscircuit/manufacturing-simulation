import { getStationStandPose } from "lib/layout/get-station-stand-pose"
import { type Station, STATIONS } from "lib/layout/station-layout"
import { isFloorPointFree } from "lib/navigation/is-floor-point-free"
import { ASSEMBLY_JOB_STEPS } from "lib/job/assembly-job-steps"
import { runJobStep } from "lib/job/run-job-step"
import {
  pickUpLooseScrewdriver,
  putBackLooseScrewdriver,
} from "lib/job/screwdriver-motions"
import { OPERATOR_GAME_WALK_SPEED_MPS } from "lib/operator/operator-body"
import type { SimContext } from "lib/simulation/sim-context"
import type { SimTask } from "lib/tasks/coroutines"
import {
  getAngleDifferenceRadians,
  walkToStation,
} from "lib/tasks/operator-motions"

/** Something the player can do from where they stand. */
export interface GameAction {
  label: string
  createTask: () => SimTask
}

export interface GameActions {
  /** Next job step, bound to E. */
  stepAction: GameAction | null
  /** Pick up or put back the screwdriver, bound to F. */
  screwdriverAction: GameAction | null
}

/** Joystick-style input, -1..1 on each axis, relative to the camera's heading. */
export interface WalkInput {
  forward: number
  right: number
  cameraCcwYawRadians: number
}

const ACTION_RANGE_M = 0.95
const PLAYER_CLEARANCE_M = 0.25
const TURN_RATE_RADIANS_PER_SECOND = 9
const INPUT_DEAD_ZONE = 0.15

function isNearStation(station: Station, ctx: SimContext): boolean {
  const pose = getStationStandPose(station)
  return (
    Math.hypot(
      pose.x - ctx.operator.position.x,
      pose.z - ctx.operator.position.z,
    ) < ACTION_RANGE_M
  )
}

function* stepUpAndRun(
  params: { station: Station; createTask: () => SimTask },
  ctx: SimContext,
): SimTask {
  ctx.statusText = "Stepping up to the bench"
  yield* walkToStation(params.station, ctx)
  yield* params.createTask()
}

/** Actions available to the player right now. Empty while a task is running. */
export function getGameActions(
  params: { isTaskRunning: boolean },
  ctx: SimContext,
): GameActions {
  const actions: GameActions = { stepAction: null, screwdriverAction: null }
  if (params.isTaskRunning || ctx.mode !== "game") return actions
  const { progress, operator } = ctx

  if (progress.isHoldingLooseScrewdriver) {
    if (isNearStation(STATIONS.assembly, ctx)) {
      actions.screwdriverAction = {
        label: "Put the screwdriver back",
        createTask: () =>
          stepUpAndRun(
            {
              station: STATIONS.assembly,
              createTask: () => putBackLooseScrewdriver(ctx),
            },
            ctx,
          ),
      }
    }
    return actions
  }

  const stepIndex = progress.completedStepCount
  const nextStep = ASSEMBLY_JOB_STEPS[stepIndex]
  if (nextStep && isNearStation(nextStep.station, ctx)) {
    actions.stepAction = {
      label: nextStep.label,
      createTask: () =>
        stepUpAndRun(
          {
            station: nextStep.station,
            createTask: () => runJobStep({ stepIndex }, ctx),
          },
          ctx,
        ),
    }
  }
  const handsAreEmpty =
    !operator.leftHand.heldObject && !operator.rightHand.heldObject
  if (handsAreEmpty && isNearStation(STATIONS.assembly, ctx)) {
    actions.screwdriverAction = {
      label: "Pick up the screwdriver",
      createTask: () =>
        stepUpAndRun(
          {
            station: STATIONS.assembly,
            createTask: () => pickUpLooseScrewdriver(ctx),
          },
          ctx,
        ),
    }
  }
  return actions
}

/** Move the operator from player input, sliding along walls and tables. */
export function applyWalkInput(
  params: { walkInput: WalkInput; dtSeconds: number },
  ctx: SimContext,
): void {
  const { walkInput, dtSeconds } = params
  const { operator } = ctx
  let { forward, right } = walkInput
  const magnitude = Math.hypot(forward, right)
  if (magnitude < INPUT_DEAD_ZONE) {
    operator.walkSpeedMps = 0
    return
  }
  if (magnitude > 1) {
    forward /= magnitude
    right /= magnitude
  }
  // The camera looks along -(sin yaw, cos yaw); "forward" walks away from the camera.
  const forwardX = -Math.sin(walkInput.cameraCcwYawRadians)
  const forwardZ = -Math.cos(walkInput.cameraCcwYawRadians)
  const moveX = forwardX * forward - forwardZ * right
  const moveZ = forwardZ * forward + forwardX * right
  const speedMps = OPERATOR_GAME_WALK_SPEED_MPS * Math.min(1, magnitude)
  const turnRadians = getAngleDifferenceRadians({
    fromRadians: operator.ccwYawRadians,
    toRadians: Math.atan2(moveX, moveZ),
  })
  const maxTurnRadians = TURN_RATE_RADIANS_PER_SECOND * dtSeconds
  operator.ccwYawRadians += Math.max(
    -maxTurnRadians,
    Math.min(maxTurnRadians, turnRadians),
  )

  const nextX = operator.position.x + moveX * speedMps * dtSeconds
  const nextZ = operator.position.z + moveZ * speedMps * dtSeconds
  let hasMoved = false
  if (
    isFloorPointFree({
      x: nextX,
      z: operator.position.z,
      clearanceM: PLAYER_CLEARANCE_M,
    })
  ) {
    operator.position.x = nextX
    hasMoved = true
  }
  if (
    isFloorPointFree({
      x: operator.position.x,
      z: nextZ,
      clearanceM: PLAYER_CLEARANCE_M,
    })
  ) {
    operator.position.z = nextZ
    hasMoved = true
  }
  operator.walkSpeedMps = hasMoved ? speedMps : 0
}
