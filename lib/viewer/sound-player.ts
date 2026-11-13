import type { SimContext } from "lib/simulation/sim-context"
import type { SoundCue } from "lib/simulation/sound-cues"
import type { Vector3 } from "three"

/** Sound is loudest within this distance of the operator, then falls off. */
const FULL_VOLUME_DISTANCE_M = 2
const MASTER_GAIN = 0.55
/** Screwdriver and stepper loops fade in and out over this time. */
const LOOP_FADE_SECONDS = 0.06

/** A tone or noise burst with a fast attack and an exponential-ish decay. */
interface Voice {
  startOffsetSeconds?: number
  durationSeconds: number
  gain: number
}

/**
 * Synthesized shop-floor sound: one-off cues from the simulation, plus
 * footsteps, the SKIL screwdriver and the QC spin test read from the scene.
 * WebAudio only starts after a user gesture, so call `unlock` from one.
 */
export class SoundPlayer {
  private audio: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private screwdriverLoop: {
    gain: GainNode
    oscillator: OscillatorNode
  } | null = null
  private stepperLoop: { gain: GainNode; oscillator: OscillatorNode } | null =
    null
  private isEnabled = true
  private previousGaitPhaseRadians = 0
  private previousScrewdriverRadians = 0
  private previousRotorRadians: number[] = []

  get isOn(): boolean {
    return this.isEnabled
  }

  setOn(isOn: boolean): void {
    this.isEnabled = isOn
    if (this.master && this.audio)
      this.master.gain.setTargetAtTime(
        isOn ? MASTER_GAIN : 0,
        this.audio.currentTime,
        0.05,
      )
    if (isOn) this.unlock()
  }

  /** Create or resume the audio context. Call from a click or key press. */
  unlock(): void {
    if (!this.isEnabled) return
    if (!this.audio) {
      const audio = new AudioContext()
      const master = audio.createGain()
      master.gain.value = MASTER_GAIN
      master.connect(audio.destination)
      const noiseBuffer = audio.createBuffer(
        1,
        audio.sampleRate,
        audio.sampleRate,
      )
      const samples = noiseBuffer.getChannelData(0)
      for (let index = 0; index < samples.length; index++)
        samples[index] = Math.random() * 2 - 1
      this.audio = audio
      this.master = master
      this.noiseBuffer = noiseBuffer
      this.screwdriverLoop = this.createLoop({
        type: "sawtooth",
        frequencyHz: 210,
        lowpassHz: 1400,
      })
      this.stepperLoop = this.createLoop({
        type: "square",
        frequencyHz: 520,
        lowpassHz: 2200,
      })
    }
    if (this.audio.state === "suspended") void this.audio.resume()
  }

  dispose(): void {
    void this.audio?.close()
    this.audio = null
  }

  /** Play queued cues and update the continuous sounds for this frame. */
  update(params: {
    ctx: SimContext
    cameraPosition: Vector3
    isPaused: boolean
  }): void {
    const { ctx } = params
    const cues = ctx.soundCues.splice(0, ctx.soundCues.length)
    const { operator, world } = ctx
    const distanceM = params.cameraPosition.distanceTo(operator.position)
    const proximity = Math.min(
      1,
      FULL_VOLUME_DISTANCE_M / Math.max(0.1, distanceM),
    )

    // Footsteps: one per half gait cycle while walking.
    const stepIndex = Math.floor(operator.gaitPhaseRadians / Math.PI)
    const previousStepIndex = Math.floor(
      this.previousGaitPhaseRadians / Math.PI,
    )
    const isFootfall =
      stepIndex !== previousStepIndex && operator.gaitBlend > 0.35
    this.previousGaitPhaseRadians = operator.gaitPhaseRadians

    const screwdriverRadians = world.screwdriver.spinningPart.rotation.y
    const isScrewdriverRunning =
      Math.abs(screwdriverRadians - this.previousScrewdriverRadians) > 1e-4
    this.previousScrewdriverRadians = screwdriverRadians

    let isMotorSpinning = false
    for (const [index, unit] of world.units.entries()) {
      const radians = unit.motor.rotor.rotation.y
      if (
        Math.abs(radians - (this.previousRotorRadians[index] ?? radians)) > 1e-3
      )
        isMotorSpinning = true
      this.previousRotorRadians[index] = radians
    }

    const audio = this.audio
    if (!audio || !this.isEnabled || audio.state !== "running") return
    const isRunning = !params.isPaused
    this.setLoopLevel({
      loop: this.screwdriverLoop,
      gain: isRunning && isScrewdriverRunning ? 0.16 * proximity : 0,
    })
    this.setLoopLevel({
      loop: this.stepperLoop,
      gain: isRunning && isMotorSpinning ? 0.07 * proximity : 0,
    })
    if (isFootfall)
      this.playNoise({
        durationSeconds: 0.07,
        gain: 0.22 * proximity,
        lowpassHz: 520,
      })
    for (const cue of cues) this.playCue({ cue, volume: proximity })
  }

  private createLoop(params: {
    type: OscillatorType
    frequencyHz: number
    lowpassHz: number
  }): { gain: GainNode; oscillator: OscillatorNode } | null {
    const { audio, master } = this
    if (!audio || !master) return null
    const oscillator = audio.createOscillator()
    oscillator.type = params.type
    oscillator.frequency.value = params.frequencyHz
    // A little wobble so the motor doesn't sound like a test tone.
    const wobble = audio.createOscillator()
    const wobbleDepth = audio.createGain()
    wobble.frequency.value = 23
    wobbleDepth.gain.value = params.frequencyHz * 0.03
    wobble.connect(wobbleDepth).connect(oscillator.frequency)
    const filter = audio.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = params.lowpassHz
    const gain = audio.createGain()
    gain.gain.value = 0
    oscillator.connect(filter).connect(gain).connect(master)
    oscillator.start()
    wobble.start()
    return { gain, oscillator }
  }

  private setLoopLevel(params: {
    loop: { gain: GainNode } | null
    gain: number
  }): void {
    if (!params.loop || !this.audio) return
    params.loop.gain.gain.setTargetAtTime(
      params.gain,
      this.audio.currentTime,
      LOOP_FADE_SECONDS,
    )
  }

  private playTone(
    params: Voice & { frequencyHz: number; type?: OscillatorType },
  ): void {
    const { audio, master } = this
    if (!audio || !master) return
    const startSeconds = audio.currentTime + (params.startOffsetSeconds ?? 0)
    const oscillator = audio.createOscillator()
    oscillator.type = params.type ?? "sine"
    oscillator.frequency.value = params.frequencyHz
    const gain = audio.createGain()
    gain.gain.setValueAtTime(0, startSeconds)
    gain.gain.linearRampToValueAtTime(params.gain, startSeconds + 0.004)
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      startSeconds + params.durationSeconds,
    )
    oscillator.connect(gain).connect(master)
    oscillator.start(startSeconds)
    oscillator.stop(startSeconds + params.durationSeconds + 0.02)
  }

  private playNoise(
    params: Voice & {
      lowpassHz?: number
      highpassHz?: number
      bandpassHz?: number
    },
  ): void {
    const { audio, master } = this
    const noiseBuffer = this.noiseBuffer
    if (!audio || !master || !noiseBuffer) return
    const startSeconds = audio.currentTime + (params.startOffsetSeconds ?? 0)
    const source = audio.createBufferSource()
    source.buffer = noiseBuffer
    source.loop = true
    let node: AudioNode = source
    for (const [type, frequencyHz] of [
      ["lowpass", params.lowpassHz],
      ["highpass", params.highpassHz],
      ["bandpass", params.bandpassHz],
    ] as const) {
      if (!frequencyHz) continue
      const filter = audio.createBiquadFilter()
      filter.type = type
      filter.frequency.value = frequencyHz
      node = node.connect(filter)
    }
    const gain = audio.createGain()
    gain.gain.setValueAtTime(0, startSeconds)
    gain.gain.linearRampToValueAtTime(params.gain, startSeconds + 0.005)
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      startSeconds + params.durationSeconds,
    )
    node.connect(gain).connect(master)
    source.start(startSeconds, Math.random() * 0.5)
    source.stop(startSeconds + params.durationSeconds + 0.02)
  }

  private playCue(params: { cue: SoundCue; volume: number }): void {
    const volume = params.volume
    switch (params.cue) {
      case "plug_click":
        this.playNoise({
          durationSeconds: 0.025,
          gain: 0.5 * volume,
          highpassHz: 2500,
        })
        this.playTone({
          durationSeconds: 0.03,
          gain: 0.2 * volume,
          frequencyHz: 3200,
        })
        return
      case "plug_pull":
        this.playNoise({
          durationSeconds: 0.04,
          gain: 0.3 * volume,
          bandpassHz: 1800,
        })
        return
      case "board_chirp":
        // Piezo buzzer on the controller: two short beeps near its resonance.
        for (const offset of [0, 0.13])
          this.playTone({
            startOffsetSeconds: offset,
            durationSeconds: 0.09,
            gain: 0.12 * volume,
            frequencyHz: 2700,
            type: "square",
          })
        return
      case "qc_pass":
        this.playTone({
          durationSeconds: 0.35,
          gain: 0.25 * volume,
          frequencyHz: 880,
        })
        this.playTone({
          startOffsetSeconds: 0.12,
          durationSeconds: 0.5,
          gain: 0.25 * volume,
          frequencyHz: 1320,
        })
        return
      case "box_close":
        this.playNoise({
          durationSeconds: 0.12,
          gain: 0.45 * volume,
          lowpassHz: 400,
        })
        this.playTone({
          durationSeconds: 0.12,
          gain: 0.25 * volume,
          frequencyHz: 95,
        })
        return
      case "flap_fold":
        this.playNoise({
          durationSeconds: 0.45,
          gain: 0.25 * volume,
          bandpassHz: 900,
        })
        return
      case "tape_gun":
        // The screech of tape unrolling, then the blade snapping it off.
        this.playNoise({
          durationSeconds: 1.3,
          gain: 0.35 * volume,
          bandpassHz: 2600,
        })
        this.playTone({
          durationSeconds: 1.2,
          gain: 0.04 * volume,
          frequencyHz: 1150,
          type: "sawtooth",
        })
        this.playNoise({
          startOffsetSeconds: 1.35,
          durationSeconds: 0.05,
          gain: 0.5 * volume,
          highpassHz: 3000,
        })
        return
      case "label_printer":
        // Inkjet carriage passes on the Epson, quieter since it's across the room.
        for (let pass = 0; pass < 6; pass++)
          this.playTone({
            startOffsetSeconds: pass * 0.28,
            durationSeconds: 0.24,
            gain: 0.05,
            frequencyHz: 140 + (pass % 2) * 25,
            type: "sawtooth",
          })
        return
      case "print_done":
        for (const offset of [0, 0.2, 0.4])
          this.playTone({
            startOffsetSeconds: offset,
            durationSeconds: 0.14,
            gain: 0.1,
            frequencyHz: 1600,
          })
        return
      case "screw_drop":
        this.playTone({
          durationSeconds: 0.14,
          gain: 0.12 * volume,
          frequencyHz: 3300,
        })
        this.playTone({
          durationSeconds: 0.1,
          gain: 0.08 * volume,
          frequencyHz: 5100,
        })
        return
      case "pour_spacers":
        // Dozens of light PLA parts clattering in.
        for (let index = 0; index < 28; index++)
          this.playNoise({
            startOffsetSeconds: index * 0.05 + Math.random() * 0.04,
            durationSeconds: 0.03,
            gain: (0.12 + Math.random() * 0.1) * volume,
            bandpassHz: 1500 + Math.random() * 1500,
          })
        return
    }
  }
}
