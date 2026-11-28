import { createOperator } from "lib/operator/create-operator"
import { updateOperatorPose } from "lib/operator/update-operator-pose"
import {
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import {
  createMotorTable,
  createSurveyAntenna,
  createSurveyCart,
} from "./equipment"
import { createNeighborhood } from "./neighborhood"
import { antennaSite, cartSite, motorSite, route, sampleSurvey } from "./plan"
import { box, paint, rod, sign } from "./shapes"

export type SurveyView = "follow" | "plan" | "bench"

export function createSurveyScene(host: HTMLDivElement) {
  const renderer = new WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.domElement.setAttribute(
    "aria-label",
    "3D view of the operator, equipment cart and outdoor motor test",
  )
  host.appendChild(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color(0xdde4d8)
  scene.fog = new Fog(0xdde4d8, 23, 91)
  scene.add(new HemisphereLight(0xfff1da, 0xa6b09e, 2.05))
  const sun = new DirectionalLight(0xffefce, 2.28)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  Object.assign(sun.shadow.camera, {
    left: -8,
    right: 8,
    top: 8,
    bottom: -8,
    near: 1,
    far: 44,
  })
  sun.shadow.camera.updateProjectionMatrix()
  sun.shadow.normalBias = 0.012
  sun.shadow.bias = -0.00035
  scene.add(sun, sun.target, createNeighborhood())
  const camera = new PerspectiveCamera(41, 1, 0.025, 170)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = false
  controls.minPolarAngle = 0.06
  controls.maxPolarAngle = Math.PI * 0.475
  controls.minDistance = 0.18
  controls.maxDistance = 80
  const operator = createOperator()
  const cart = createSurveyCart()
  const table = createMotorTable()
  const tripod = createSurveyAntenna()
  scene.add(operator.group, cart.group, table.group, tripod.group)

  const measure = new Group()
  const tape = paint(0xebbd5e)
  const offsetZ = motorSite.z + 0.65
  rod(
    measure,
    tape,
    [antennaSite.x, 0.034, offsetZ],
    [motorSite.x, 0.034, offsetZ],
    0.012,
  )
  for (const x of [antennaSite.x, motorSite.x])
    rod(
      measure,
      tape,
      [x, 0.035, offsetZ - 0.12],
      [x, 0.035, offsetZ + 0.12],
      0.016,
    )
  sign(
    measure,
    "3.0 m",
    0.49,
    0.166,
    [(antennaSite.x + motorSite.x) / 2, 0.18, offsetZ],
    { background: "#254c44" },
  )
  scene.add(measure)

  const routeMarks = new Group()
  const trail = paint(0xd9763e)
  for (let i = 0; i <= 58; i++) {
    const p = route.getPointAt(i / 58)
    box(routeMarks, trail, [0.17, 0.018, 0.17], [p.x, 0.049, p.z])
  }
  scene.add(routeMarks)

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = host
    renderer.setSize(Math.max(1, w), Math.max(1, h), false)
    camera.aspect = Math.max(1, w) / Math.max(1, h)
    camera.updateProjectionMatrix()
    previousView = undefined
  }
  let previousView: SurveyView | undefined
  let previousFraming = ""
  let lastTime = Number.NaN
  let cameraMoved = true
  controls.addEventListener("change", () => {
    cameraMoved = true
  })
  const previousFocus = new Vector3()
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  const tableLoad = new Vector3(0, 0.86, 0.065)
  const tripodLoad = new Vector3(0.182, 0.31, -0.36)
  const tableAt = motorSite.clone().setY(0.79)

  function draw(time: number, view: SurveyView) {
    if (lastTime === time && previousView === view && !cameraMoved) return
    const s = sampleSurvey(time)
    const dt =
      Number.isNaN(lastTime) || Math.abs(time - lastTime) > 0.4
        ? 1
        : Math.abs(time - lastTime)
    cart.group.position.copy(s.cart)
    cart.group.rotation.y = s.cartYaw
    cart.group.updateMatrixWorld(true)
    for (const wheel of cart.wheels)
      wheel.rotation.x =
        Math.max(0, Math.min(18, time - 5)) * 17 +
        Math.max(0, Math.min(17, time - 77)) * 17
    const packedTable = cart.group.localToWorld(tableLoad.clone())
    const packedTripod = cart.group.localToWorld(tripodLoad.clone())
    const lift = (progress: number) => Math.sin(progress * Math.PI)
    table.group.position.copy(packedTable).lerp(tableAt, s.tableTravel)
    table.group.position.y += 0.24 * lift(s.tableTravel)
    table.group.rotation.y = s.cartYaw * (1 - s.tableTravel)
    table.update(s.tableOpen, s.motorOn, s.spinning, time)

    tripod.group.position.copy(packedTripod).lerp(antennaSite, s.antennaTravel)
    tripod.group.position.y += 0.65 * lift(s.antennaTravel)
    tripod.group.rotation.set(0, s.cartYaw * (1 - s.antennaTravel), 0)
    tripod.group.rotateX((1 - s.antennaOpen) * 1.48)
    tripod.group.scale.setScalar(0.7 + 0.3 * s.antennaOpen)
    tripod.update(s.antennaOpen, s.vertical)
    measure.visible = s.tableOpen > 0.999 && s.antennaOpen > 0.999
    routeMarks.visible = view === "plan"
    operator.position.copy(s.walk)
    operator.ccwYawRadians = s.operatorYaw
    operator.walkSpeedMps = s.walking ? 1.25 : 0
    operator.isCarryingLoad = s.carrying
    const heldKit =
      s.tableTravel > 0 && s.tableTravel < 1 ? table.group : tripod.group
    if (s.carrying) {
      const toward = heldKit.position.clone().sub(s.walk)
      operator.ccwYawRadians = Math.atan2(toward.x, toward.z)
    }
    for (const hand of operator.hands) {
      hand.isReaching =
        s.pushing || s.carrying || (s.scanning && hand.side === 1)
      hand.targetFingerCurl = hand.isReaching ? 0.71 : 0.16
      hand.targetFingerDirection.set(0, -0.9, 0.35)
      if (s.pushing) {
        hand.targetPosition.copy(
          cart.group.localToWorld(
            new Vector3(hand.side * 0.192, 0.816, -0.606),
          ),
        )
      } else if (s.carrying) {
        hand.targetPosition.copy(heldKit.position)
        hand.targetPosition.x += hand.side * 0.135
        hand.targetPosition.y = Math.max(0.71, heldKit.position.y)
      } else if (s.scanning) {
        hand.targetPosition.copy(antennaSite).add(new Vector3(0, 0.72, -0.08))
      }
    }
    updateOperatorPose(operator, dt)
    const isBench = view === "bench" && s.scanning
    const field = s.inField && time >= 24.2 && time < 73.8
    const framing = isBench ? "bench" : field ? "field" : "cart"
    const focus = isBench
      ? motorSite.clone().setY(0.83)
      : field
        ? new Vector3((antennaSite.x + cartSite.x) / 2 + 0.36, 0.69, -9.85)
        : s.cart.clone().lerp(s.walk, 0.42).setY(1.02)
    if (view === "plan") focus.set(-1, 0.12, 0.0)
    const plan = view === "plan"
    if (previousView !== view || (!plan && previousFraming !== framing)) {
      const offset = plan
        ? new Vector3(0.1, 40, 21)
        : isBench
          ? new Vector3(0.29, 0.19, 0.4)
          : field
            ? new Vector3(0.8, 2.75, 6.85)
            : new Vector3(3.15, 1.31, 2.72)
      const aspect = camera.aspect
      offset.multiplyScalar(
        plan
          ? Math.max(1.23, 1.81 / aspect)
          : field
            ? Math.max(0.87, 1.42 / aspect)
            : Math.max(0.93, 0.69 / aspect),
      )
      controls.target.copy(focus)
      camera.position.copy(focus).add(offset)
      controls.update()
    } else {
      const delta = focus.clone().sub(previousFocus)
      camera.position.add(delta)
      controls.target.add(delta)
    }
    previousFocus.copy(focus)
    previousFraming = framing
    previousView = view
    lastTime = time
    sun.target.position.copy(s.cart).lerp(field ? motorSite : s.walk, 0.45)
    sun.position.copy(sun.target.position).add(new Vector3(8, 12, 7))
    controls.update()
    renderer.render(scene, camera)
    cameraMoved = false
  }
  return {
    draw,
    dispose() {
      observer.disconnect()
      controls.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
