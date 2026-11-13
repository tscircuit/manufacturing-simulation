import {
  type AudioKit,
  connectFilters,
  playNoiseBurst,
  playPing,
} from "lib/viewer/sound/audio-kit"

/**
 * SKIL Twist 2.0 at full trigger: its small brushed motor spins at roughly
 * 15,000 rpm (250 Hz) behind a planetary gearbox.
 */
const SCREWDRIVER_MOTOR_HZ = 250
/** A three-slot commutator: six brush contacts per turn give the buzzy edge. */
const COMMUTATOR_HARMONIC = 6
/** Planet gear mesh, relative to the motor shaft. */
const GEAR_MESH_HARMONIC = 2.7
/** How far the motor slows when a screw is seating. */
const STALL_SLOWDOWN = 0.28
/** Full steps per revolution of a 1.8 degree stepper. */
const STEPPER_STEPS_PER_REV = 200

/** A held tone or noise whose pitch and level the voice moves smoothly. */
interface HeldPartial {
  frequencyRatio: number
  oscillator: OscillatorNode
}

function createPartial(
  params: {
    type: OscillatorType
    frequencyRatio: number
    gain: number
    output: AudioNode
    filters?: Array<{ type: BiquadFilterType; frequencyHz: number; q?: number }>
  },
  kit: AudioKit,
): HeldPartial {
  const oscillator = kit.audio.createOscillator()
  oscillator.type = params.type
  oscillator.frequency.value = 0
  const gain = kit.audio.createGain()
  gain.gain.value = params.gain
  connectFilters({ from: oscillator, filters: params.filters ?? [] }, kit)
    .connect(gain)
    .connect(params.output)
  oscillator.start()
  return { frequencyRatio: params.frequencyRatio, oscillator }
}

/**
 * The cordless screwdriver: motor whine, commutator buzz, gear mesh and
 * brush noise, which spin up and down with the bit and drop in pitch under
 * load. Trigger clicks and the clutch ratchet are one-off sounds.
 */
export class ScrewdriverVoice {
  private readonly output: GainNode
  private readonly partials: HeldPartial[]
  private readonly brushNoise: BiquadFilterNode
  private readonly rumble: GainNode
  private isRunning = false
  private wasDrivingIn = false
  private loadAtStop = 0

  constructor(private readonly kit: AudioKit) {
    const { audio } = kit
    this.output = audio.createGain()
    this.output.gain.value = 0
    // A slow gearbox wobble on the whole voice.
    this.rumble = audio.createGain()
    this.rumble.gain.value = 1
    const wobble = audio.createOscillator()
    wobble.frequency.value = 31
    const wobbleDepth = audio.createGain()
    wobbleDepth.gain.value = 0.18
    wobble.connect(wobbleDepth).connect(this.rumble.gain)
    wobble.start()
    this.output.connect(this.rumble).connect(kit.operatorBus)

    this.partials = [
      createPartial(
        {
          type: "sawtooth",
          frequencyRatio: 1,
          gain: 0.35,
          output: this.output,
          filters: [{ type: "lowpass", frequencyHz: 1800 }],
        },
        kit,
      ),
      createPartial(
        {
          type: "square",
          frequencyRatio: COMMUTATOR_HARMONIC,
          gain: 0.12,
          output: this.output,
          filters: [{ type: "bandpass", frequencyHz: 1600, q: 2.5 }],
        },
        kit,
      ),
      createPartial(
        {
          type: "triangle",
          frequencyRatio: GEAR_MESH_HARMONIC,
          gain: 0.22,
          output: this.output,
        },
        kit,
      ),
      createPartial(
        {
          type: "sine",
          frequencyRatio: 0.5,
          gain: 0.25,
          output: this.output,
        },
        kit,
      ),
    ]
    // Brush and bearing hiss.
    const noise = audio.createBufferSource()
    noise.buffer = kit.noise
    noise.loop = true
    this.brushNoise = audio.createBiquadFilter()
    this.brushNoise.type = "bandpass"
    this.brushNoise.frequency.value = 3800
    this.brushNoise.Q.value = 0.9
    const noiseGain = audio.createGain()
    noiseGain.gain.value = 0.35
    noise.connect(this.brushNoise).connect(noiseGain).connect(this.output)
    noise.start()
  }

  /** `load` is 0 spinning free to 1 seating a screw; `isDrivingIn` is the bit turning clockwise. */
  update(params: {
    isSpinning: boolean
    load: number
    isDrivingIn: boolean
    volume: number
  }): void {
    const { audio } = this.kit
    const now = audio.currentTime
    if (params.isSpinning && !this.isRunning) {
      this.playTriggerClick({ volume: params.volume })
      this.isRunning = true
    }
    if (!params.isSpinning && this.isRunning) {
      this.isRunning = false
      this.playTriggerClick({ volume: params.volume * 0.7 })
      // Seating a screw: the clutch slips and ratchets for a moment.
      if (this.wasDrivingIn && this.loadAtStop > 0.5)
        this.playClutchRatchet({ volume: params.volume })
    }
    this.wasDrivingIn = params.isDrivingIn
    this.loadAtStop = params.load
    const motorHz = this.isRunning
      ? SCREWDRIVER_MOTOR_HZ * (1 - STALL_SLOWDOWN * params.load)
      : 0
    // Quick spin-up; a longer coast down with the pitch falling away.
    const timeConstant = this.isRunning ? 0.035 : 0.12
    for (const partial of this.partials)
      partial.oscillator.frequency.setTargetAtTime(
        Math.max(1, motorHz * partial.frequencyRatio),
        now,
        timeConstant,
      )
    this.brushNoise.frequency.setTargetAtTime(
      2800 + 1400 * (motorHz / SCREWDRIVER_MOTOR_HZ),
      now,
      timeConstant,
    )
    const level = this.isRunning
      ? params.volume * (0.13 + 0.05 * params.load)
      : 0
    this.output.gain.setTargetAtTime(level, now, this.isRunning ? 0.02 : 0.09)
  }

  private playTriggerClick(params: { volume: number }): void {
    playNoiseBurst(
      {
        durationSeconds: 0.018,
        gain: 0.18 * params.volume,
        filters: [{ type: "bandpass", frequencyHz: 3200, q: 1.5 }],
      },
      this.kit,
    )
  }

  private playClutchRatchet(params: { volume: number }): void {
    for (let click = 0; click < 5; click++)
      playNoiseBurst(
        {
          atSeconds: 0.02 + click * 0.028,
          durationSeconds: 0.012,
          gain: (0.2 - click * 0.03) * params.volume,
          filters: [
            { type: "highpass", frequencyHz: 1800 },
            { type: "peaking", frequencyHz: 4200, q: 4 },
          ],
        },
        this.kit,
      )
  }
}

/**
 * NEMA17 on a DRV8825 during the QC spin test. A stepper sings at its step
 * rate, so the tone follows the rotor's real speed: it sweeps up while the
 * move accelerates, holds while cruising, and sweeps down to a stop.
 */
export class StepperVoice {
  private readonly output: GainNode
  private readonly stepTone: OscillatorNode
  private readonly subTone: OscillatorNode
  private readonly hiss: BiquadFilterNode
  private stepHz = 0

  constructor(private readonly kit: AudioKit) {
    const { audio } = kit
    this.output = audio.createGain()
    this.output.gain.value = 0
    this.output.connect(kit.operatorBus)
    // Narrow current pulses at the step rate: lots of harmonics, shaped by the motor can's resonances.
    const harmonicCount = 16
    const real = new Float32Array(harmonicCount)
    const imaginary = new Float32Array(harmonicCount)
    for (let harmonic = 1; harmonic < harmonicCount; harmonic++)
      imaginary[harmonic] = 1 / harmonic ** 0.8
    this.stepTone = audio.createOscillator()
    this.stepTone.setPeriodicWave(audio.createPeriodicWave(real, imaginary))
    this.stepTone.frequency.value = 1
    const stepGain = audio.createGain()
    stepGain.gain.value = 0.3
    connectFilters(
      {
        from: this.stepTone,
        filters: [
          { type: "peaking", frequencyHz: 1150, q: 3 },
          { type: "peaking", frequencyHz: 2400, q: 4 },
          { type: "lowpass", frequencyHz: 5000 },
        ],
      },
      kit,
    )
      .connect(stepGain)
      .connect(this.output)
    // The rotor's own once-per-tooth hum (50 teeth).
    this.subTone = audio.createOscillator()
    this.subTone.type = "triangle"
    this.subTone.frequency.value = 1
    const subGain = audio.createGain()
    subGain.gain.value = 0.2
    this.subTone.connect(subGain).connect(this.output)
    // Bearing and driver chopper hiss.
    const noise = audio.createBufferSource()
    noise.buffer = kit.noise
    noise.loop = true
    this.hiss = audio.createBiquadFilter()
    this.hiss.type = "bandpass"
    this.hiss.frequency.value = 6000
    this.hiss.Q.value = 0.7
    const hissGain = audio.createGain()
    hissGain.gain.value = 0.05
    noise.connect(this.hiss).connect(hissGain).connect(this.output)
    this.stepTone.start()
    this.subTone.start()
    noise.start()
  }

  update(params: { revolutionsPerSecond: number; volume: number }): void {
    const { audio } = this.kit
    const now = audio.currentTime
    const targetStepHz = params.revolutionsPerSecond * STEPPER_STEPS_PER_REV
    const wasStopped = this.stepHz < 5
    this.stepHz += (targetStepHz - this.stepHz) * 0.5
    if (wasStopped && targetStepHz > 5) this.playEnergizeClunk(params)
    if (this.stepHz < 2) {
      this.output.gain.setTargetAtTime(0, now, 0.04)
      return
    }
    this.stepTone.frequency.setTargetAtTime(this.stepHz, now, 0.05)
    this.subTone.frequency.setTargetAtTime(this.stepHz / 4, now, 0.05)
    // Quieter at the very bottom of the sweep, loudest through the mid-band resonance.
    const level = Math.min(1, this.stepHz / 180) * 0.11 * params.volume
    this.output.gain.setTargetAtTime(level, now, 0.03)
  }

  /** The coils energizing: a soft knock as the rotor snaps to its first step. */
  private playEnergizeClunk(params: { volume: number }): void {
    playPing(
      {
        frequencyHz: 180,
        endFrequencyHz: 90,
        durationSeconds: 0.08,
        gain: 0.15 * params.volume,
      },
      this.kit,
    )
  }
}
