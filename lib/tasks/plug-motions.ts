import type { CablePlug } from "lib/models/plugs"
import type { OperatorHand } from "lib/operator/create-operator"
import type { SimContext } from "lib/simulation/sim-context"
import { playCue } from "lib/simulation/sound-cues"
import type { SimTask } from "lib/tasks/coroutines"
import { grabObject, moveObject, releaseHand } from "lib/tasks/operator-motions"
import { type Object3D, type Quaternion, Vector3 } from "three"

/** How far out of the port a plug lines up before pushing in. */
const PLUG_LEAD_IN_M = 0.014
const PLUG_GRIP_POINT = new Vector3(0, 0.014, 0)

/** Pose of `port` in its parent's frame, backed out along the port's +Y. */
function getLeadInPosition(port: Object3D): Vector3 {
  return new Vector3(0, PLUG_LEAD_IN_M, 0)
    .applyQuaternion(port.quaternion)
    .add(port.position)
}

/** Pick a plug up, line it up with a port, and push it home. */
export function* plugIn(
  params: { plug: CablePlug; hand: OperatorHand; port: Object3D },
  ctx: SimContext,
): SimTask {
  const { plug, hand, port } = params
  const portParent = port.parent
  if (!portParent) throw new Error("Port anchor must be attached to a part")
  yield* grabObject({
    hand,
    object: plug.group,
    localGripPoint: PLUG_GRIP_POINT,
    fingerCurl: 0.95,
    durationSeconds: 0.6,
  })
  yield* moveObject(
    {
      object: plug.group,
      hand,
      parent: portParent,
      localPosition: getLeadInPosition(port),
      localQuaternion: port.quaternion,
      durationSeconds: 0.8,
      arcHeightM: 0.04,
    },
    ctx,
  )
  yield* moveObject(
    {
      object: plug.group,
      hand,
      parent: portParent,
      localPosition: port.position,
      localQuaternion: port.quaternion,
      durationSeconds: 0.35,
    },
    ctx,
  )
  playCue(plug.kind === "usb_c" ? "usb_click" : "jst_click", ctx)
  yield* releaseHand(hand)
}

/** Pull a plug straight out of its port and lay it down at a rest pose. */
export function* unplug(
  params: {
    plug: CablePlug
    hand: OperatorHand
    restParent: Object3D
    restPosition: Vector3
    restQuaternion: Quaternion
  },
  ctx: SimContext,
): SimTask {
  const { plug, hand } = params
  const portParent = plug.group.parent
  if (!portParent) throw new Error("Plug is not attached to anything")
  yield* grabObject({
    hand,
    object: plug.group,
    localGripPoint: PLUG_GRIP_POINT,
    fingerCurl: 0.95,
    durationSeconds: 0.55,
  })
  playCue("plug_pull", ctx)
  const pulledOut = new Vector3(0, PLUG_LEAD_IN_M, 0)
    .applyQuaternion(plug.group.quaternion)
    .add(plug.group.position)
  yield* moveObject(
    {
      object: plug.group,
      hand,
      parent: portParent,
      localPosition: pulledOut,
      localQuaternion: plug.group.quaternion.clone(),
      durationSeconds: 0.3,
    },
    ctx,
  )
  yield* moveObject(
    {
      object: plug.group,
      hand,
      parent: params.restParent,
      localPosition: params.restPosition,
      localQuaternion: params.restQuaternion,
      durationSeconds: 0.7,
      arcHeightM: 0.03,
    },
    ctx,
  )
  yield* releaseHand(hand)
}
