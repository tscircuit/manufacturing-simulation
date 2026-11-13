/** Where a sound plays from: the operator (panned and attenuated with them) or across the room. */
export type SoundBus = "operator" | "room"

/** The audio graph every synthesized sound plays into. */
export interface AudioKit {
  audio: AudioContext
  /** Sounds made by the operator's hands and feet. Panned to where the operator is. */
  operatorBus: GainNode
  /** Equipment across the room (printers): steady level, not panned. */
  roomBus: GainNode
  /** Two seconds of white noise, looped from a random offset for every burst. */
  noise: AudioBuffer
}

export type FilterSpec = {
  type: BiquadFilterType
  frequencyHz: number
  q?: number
}

export function getBus(params: { bus?: SoundBus }, kit: AudioKit): AudioNode {
  return params.bus === "room" ? kit.roomBus : kit.operatorBus
}

/** Chain filters after a node and return the last one. */
export function connectFilters(
  params: { from: AudioNode; filters: FilterSpec[] },
  kit: AudioKit,
): AudioNode {
  let node = params.from
  for (const spec of params.filters) {
    const filter = kit.audio.createBiquadFilter()
    filter.type = spec.type
    filter.frequency.value = spec.frequencyHz
    if (spec.q !== undefined) filter.Q.value = spec.q
    node = node.connect(filter)
  }
  return node
}

/** A gain that rises in `attackSeconds` and falls off exponentially by `startSeconds + durationSeconds`. */
export function createDecayEnvelope(
  params: {
    startSeconds: number
    peakGain: number
    attackSeconds?: number
    durationSeconds: number
  },
  kit: AudioKit,
): GainNode {
  const gain = kit.audio.createGain()
  const attackSeconds = params.attackSeconds ?? 0.002
  gain.gain.setValueAtTime(0.0001, params.startSeconds)
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0002, params.peakGain),
    params.startSeconds + attackSeconds,
  )
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    params.startSeconds + params.durationSeconds,
  )
  return gain
}

/** Filtered noise with a sharp attack and decay: clicks, thumps, scuffs and rattles. */
export function playNoiseBurst(
  params: {
    atSeconds?: number
    durationSeconds: number
    gain: number
    attackSeconds?: number
    filters: FilterSpec[]
    bus?: SoundBus
  },
  kit: AudioKit,
): void {
  const startSeconds = kit.audio.currentTime + (params.atSeconds ?? 0)
  const source = kit.audio.createBufferSource()
  source.buffer = kit.noise
  source.loop = true
  const envelope = createDecayEnvelope(
    {
      startSeconds,
      peakGain: params.gain,
      attackSeconds: params.attackSeconds,
      durationSeconds: params.durationSeconds,
    },
    kit,
  )
  connectFilters({ from: source, filters: params.filters }, kit)
    .connect(envelope)
    .connect(getBus(params, kit))
  source.start(startSeconds, Math.random() * 1.5)
  source.stop(startSeconds + params.durationSeconds + 0.05)
}

/** A decaying tone: the ring of metal, plastic or a piezo. */
export function playPing(
  params: {
    atSeconds?: number
    frequencyHz: number
    durationSeconds: number
    gain: number
    type?: OscillatorType
    attackSeconds?: number
    /** Pitch at the end, for chirps and drops. */
    endFrequencyHz?: number
    filters?: FilterSpec[]
    bus?: SoundBus
  },
  kit: AudioKit,
): void {
  const startSeconds = kit.audio.currentTime + (params.atSeconds ?? 0)
  const oscillator = kit.audio.createOscillator()
  oscillator.type = params.type ?? "sine"
  oscillator.frequency.setValueAtTime(params.frequencyHz, startSeconds)
  if (params.endFrequencyHz)
    oscillator.frequency.exponentialRampToValueAtTime(
      params.endFrequencyHz,
      startSeconds + params.durationSeconds,
    )
  const envelope = createDecayEnvelope(
    {
      startSeconds,
      peakGain: params.gain,
      attackSeconds: params.attackSeconds,
      durationSeconds: params.durationSeconds,
    },
    kit,
  )
  connectFilters({ from: oscillator, filters: params.filters ?? [] }, kit)
    .connect(envelope)
    .connect(getBus(params, kit))
  oscillator.start(startSeconds)
  oscillator.stop(startSeconds + params.durationSeconds + 0.05)
}

/**
 * Impulse response for a small office with hard floors and a window wall:
 * a few early reflections, then a 0.6 s diffuse tail, slightly different per ear.
 */
export function createRoomImpulse(audio: AudioContext): AudioBuffer {
  const tailSeconds = 0.6
  const length = Math.floor(audio.sampleRate * tailSeconds)
  const impulse = audio.createBuffer(2, length, audio.sampleRate)
  const reflectionsSeconds = [0.007, 0.013, 0.019, 0.031, 0.043]
  for (let channel = 0; channel < 2; channel++) {
    const samples = impulse.getChannelData(channel)
    for (let index = 0; index < length; index++) {
      const seconds = index / audio.sampleRate
      // Higher frequencies die faster: smooth the noise more as the tail goes on.
      const decay = Math.exp(-seconds * 9)
      samples[index] = (Math.random() * 2 - 1) * decay * 0.5
    }
    for (const [order, seconds] of reflectionsSeconds.entries()) {
      const index = Math.floor(
        (seconds + channel * 0.0017 * (order % 2)) * audio.sampleRate,
      )
      if (index < length)
        samples[index] += (order % 2 ? -0.6 : 0.7) / (1 + order)
    }
    // One-pole low-pass so the tail sounds like drywall and glass, not a metal tank.
    let smoothed = 0
    for (let index = 0; index < length; index++) {
      smoothed += (samples[index] - smoothed) * 0.35
      samples[index] = smoothed
    }
  }
  return impulse
}
