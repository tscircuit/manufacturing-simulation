import { SCREW_TURN_RADIANS } from "lib/job/assembly-bench-steps"
import type { SimContext } from "lib/simulation/sim-context"
import type { SoundCue } from "lib/simulation/sound-cues"
import { type AudioKit, createRoomImpulse } from "lib/viewer/sound/audio-kit"
import { playCueSound, playFootstep } from "lib/viewer/sound/cue-sounds"
import { ScrewdriverVoice, StepperVoice } from "lib/viewer/sound/motor-voices"
import { type Camera, Vector3 } from "three"

/** Sound is loudest within this distance of the operator, then falls off. */
const FULL_VOLUME_DISTANCE_M = 2
const MASTER_GAIN = 0.7
/** How much of the room's reverb is mixed in. */
const REVERB_MIX = 0.22
/** A bit jump bigger than this in one frame is a new screw starting, not spinning. */
const SCREW_RESET_RADIANS = 3
/** Printers sound full within this distance of the camera, then fade. */
const EQUIPMENT_FULL_VOLUME_M = 2.5

/** Cues that come from a printer, not from the operator's hands. */
function isEquipmentCue(cue: SoundCue): boolean {
  return cue === "label_printer" || cue === "print_done"
}

/** Quieter the further the camera is from the printer making the sound. */
function getEquipmentVolume(params: {
  cue: SoundCue
  ctx: SimContext
  camera: Camera
}): number {
  const { tables } = params.ctx.world
  const bench =
    params.cue === "label_printer" ? tables.label_bench : tables.printer_bench
  const distanceM = bench
    .getWorldPosition(new Vector3())
    .distanceTo(params.camera.position)
  return Math.min(
    1,
    (EQUIPMENT_FULL_VOLUME_M / Math.max(0.5, distanceM)) ** 1.5,
  )
}

/**
 * Synthesized shop-floor sound, with no audio files: one-off cues from the
 * simulation; footsteps, the SKIL screwdriver and the QC stepper driven by
 * what the scene is doing. No continuous background noise.
 * Everything runs through a small-office reverb, and the operator's sounds
 * are panned and attenuated by where they are relative to the camera.
 * WebAudio only starts after a user gesture, so call `unlock` from one.
 */
export class SoundPlayer {
  private kit: AudioKit | null = null
  private master: GainNode | null = null
  private operatorPan: StereoPannerNode | null = null
  private screwdriver: ScrewdriverVoice | null = null
  private stepper: StepperVoice | null = null
  private isEnabled = true
  private previousGaitPhaseRadians = 0
  private previousScrewdriverRadians = 0
  private previousRotorRadians: number[] = []

  get isOn(): boolean {
    return this.isEnabled
  }

  setOn(isOn: boolean): void {
    this.isEnabled = isOn
    if (this.master && this.kit)
      this.master.gain.setTargetAtTime(
        isOn ? MASTER_GAIN : 0,
        this.kit.audio.currentTime,
        0.05,
      )
    if (isOn) this.unlock()
  }

  /** Create or resume the audio graph. Call from a click or key press. */
  unlock(): void {
    if (!this.isEnabled) return
    if (!this.kit) this.kit = this.createAudioGraph()
    if (this.kit.audio.state === "suspended") void this.kit.audio.resume()
  }

  dispose(): void {
    void this.kit?.audio.close()
    this.kit = null
  }

  private createAudioGraph(): AudioKit {
    const audio = new AudioContext()
    const master = audio.createGain()
    master.gain.value = MASTER_GAIN
    master.connect(audio.destination)
    const reverb = audio.createConvolver()
    reverb.buffer = createRoomImpulse(audio)
    const reverbReturn = audio.createGain()
    reverbReturn.gain.value = REVERB_MIX
    master.connect(reverb).connect(reverbReturn).connect(audio.destination)

    const noise = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate)
    const samples = noise.getChannelData(0)
    for (let index = 0; index < samples.length; index++)
      samples[index] = Math.random() * 2 - 1

    const operatorBus = audio.createGain()
    const operatorPan = audio.createStereoPanner()
    operatorBus.connect(operatorPan).connect(master)
    const roomBus = audio.createGain()
    roomBus.connect(master)
    const kit: AudioKit = { audio, operatorBus, roomBus, noise }

    this.master = master
    this.operatorPan = operatorPan
    this.screwdriver = new ScrewdriverVoice(kit)
    this.stepper = new StepperVoice(kit)
    return kit
  }

  /** Play queued cues and update the continuous sounds for this frame. */
  update(params: {
    ctx: SimContext
    camera: Camera
    /** Simulated seconds this frame; 0 while paused. */
    simDtSeconds: number
  }): void {
    const { ctx, camera, simDtSeconds } = params
    const cues = ctx.soundCues.splice(0, ctx.soundCues.length)
    const { operator, world } = ctx
    const toOperator = operator.position.clone().setY(1.1).sub(camera.position)
    const distanceM = toOperator.length()
    const volume = Math.min(
      1,
      FULL_VOLUME_DISTANCE_M / Math.max(0.1, distanceM),
    )

    const stepIndex = Math.floor(operator.gaitPhaseRadians / Math.PI)
    const isFootfall =
      stepIndex !== Math.floor(this.previousGaitPhaseRadians / Math.PI) &&
      operator.gaitBlend > 0.35
    this.previousGaitPhaseRadians = operator.gaitPhaseRadians

    const bitRadians = world.screwdriver.spinningPart.rotation.y
    const bitDeltaRadians = bitRadians - this.previousScrewdriverRadians
    this.previousScrewdriverRadians = bitRadians
    const isScrewdriverSpinning =
      simDtSeconds > 0 &&
      Math.abs(bitDeltaRadians) > 1e-4 &&
      Math.abs(bitDeltaRadians) < SCREW_RESET_RADIANS
    // Driving in turns the bit negative; removing turns it positive. Each screw starts at 0.
    const isDrivingIn = bitRadians < 0
    const screwProgress = Math.min(1, Math.abs(bitRadians) / SCREW_TURN_RADIANS)
    const load = isDrivingIn
      ? Math.max(0, (screwProgress - 0.55) / 0.45) ** 2
      : Math.max(0, 1 - screwProgress / 0.2) * 0.8

    let fastestRevolutionsPerSecond = 0
    // Every unit's motor, plus the bare-unit line's one test motor at QC.
    const rotors = world.units.map((unit) => unit.motor.rotor)
    if (world.testMotor) rotors.push(world.testMotor.rotor)
    for (const [index, rotor] of rotors.entries()) {
      const radians = rotor.rotation.y
      const previous = this.previousRotorRadians[index] ?? radians
      this.previousRotorRadians[index] = radians
      if (simDtSeconds <= 0) continue
      const revolutionsPerSecond =
        Math.abs(radians - previous) / simDtSeconds / (Math.PI * 2)
      // Ignore jumps from a reset or a part being re-posed.
      if (revolutionsPerSecond < 20)
        fastestRevolutionsPerSecond = Math.max(
          fastestRevolutionsPerSecond,
          revolutionsPerSecond,
        )
    }

    const kit = this.kit
    if (!kit || !this.isEnabled || kit.audio.state !== "running") return
    const now = kit.audio.currentTime
    // Pan the operator's sounds by where they are across the view.
    const cameraRight = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    const pan =
      distanceM > 0.3
        ? Math.max(
            -0.85,
            Math.min(0.85, toOperator.normalize().dot(cameraRight)),
          )
        : 0
    this.operatorPan?.pan.setTargetAtTime(pan, now, 0.05)

    this.screwdriver?.update({
      isSpinning: isScrewdriverSpinning,
      load,
      isDrivingIn,
      volume,
    })
    this.stepper?.update({
      revolutionsPerSecond: fastestRevolutionsPerSecond,
      volume,
    })
    if (isFootfall) playFootstep({ volume }, kit)
    for (const cue of cues)
      playCueSound(
        {
          cue,
          volume: isEquipmentCue(cue)
            ? getEquipmentVolume({ cue, ctx, camera })
            : volume,
        },
        kit,
      )
  }
}
