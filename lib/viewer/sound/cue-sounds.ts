import type { SoundCue } from "lib/simulation/sound-cues"
import {
  type AudioKit,
  connectFilters,
  playNoiseBurst,
  playPing,
} from "lib/viewer/sound/audio-kit"

/** A number near `value`, so repeated sounds never come out identical. */
function vary(value: number, amount = 0.15): number {
  return value * (1 + (Math.random() * 2 - 1) * amount)
}

/** Heel strike then the sole rolling off: work shoes on a hard tiled floor. */
export function playFootstep(params: { volume: number }, kit: AudioKit): void {
  const { volume } = params
  playNoiseBurst(
    {
      durationSeconds: vary(0.09),
      gain: vary(0.5) * volume,
      filters: [
        { type: "lowpass", frequencyHz: vary(320) },
        { type: "peaking", frequencyHz: 110, q: 1.2 },
      ],
    },
    kit,
  )
  playNoiseBurst(
    {
      atSeconds: vary(0.035),
      durationSeconds: vary(0.06),
      gain: vary(0.07) * volume,
      attackSeconds: 0.008,
      filters: [{ type: "bandpass", frequencyHz: vary(2200), q: 1.2 }],
    },
    kit,
  )
}

/** USB-C: a short friction slide, then the crisp detent click of the shell. */
function playUsbClick(params: { volume: number }, kit: AudioKit): void {
  const { volume } = params
  playNoiseBurst(
    {
      durationSeconds: 0.05,
      gain: 0.05 * volume,
      attackSeconds: 0.02,
      filters: [{ type: "bandpass", frequencyHz: 5200, q: 1.5 }],
    },
    kit,
  )
  playNoiseBurst(
    {
      atSeconds: 0.05,
      durationSeconds: 0.012,
      gain: 0.45 * volume,
      filters: [{ type: "highpass", frequencyHz: 2500 }],
    },
    kit,
  )
  playPing(
    {
      atSeconds: 0.05,
      frequencyHz: vary(4600, 0.05),
      durationSeconds: 0.03,
      gain: 0.12 * volume,
    },
    kit,
  )
}

/** JST PH: a duller nylon latch snapping over its ramp. */
function playJstClick(params: { volume: number }, kit: AudioKit): void {
  const { volume } = params
  playNoiseBurst(
    {
      durationSeconds: 0.07,
      gain: 0.04 * volume,
      attackSeconds: 0.03,
      filters: [{ type: "bandpass", frequencyHz: 2600, q: 1.2 }],
    },
    kit,
  )
  playNoiseBurst(
    {
      atSeconds: 0.07,
      durationSeconds: 0.02,
      gain: 0.35 * volume,
      filters: [
        { type: "bandpass", frequencyHz: 2100, q: 2 },
        { type: "lowpass", frequencyHz: 4000 },
      ],
    },
    kit,
  )
  playPing(
    {
      atSeconds: 0.07,
      frequencyHz: vary(2900, 0.05),
      durationSeconds: 0.025,
      gain: 0.06 * volume,
    },
    kit,
  )
}

/** M3 screw into the plastic bin: a ping, then a couple of smaller bounces. */
function playScrewDrop(params: { volume: number }, kit: AudioKit): void {
  const bounces = [
    { atSeconds: 0, gain: 0.22 },
    { atSeconds: vary(0.08), gain: 0.1 },
    { atSeconds: vary(0.13), gain: 0.05 },
  ]
  for (const bounce of bounces) {
    playPing(
      {
        atSeconds: bounce.atSeconds,
        frequencyHz: vary(5400, 0.08),
        durationSeconds: 0.06,
        gain: bounce.gain * params.volume,
      },
      kit,
    )
    playPing(
      {
        atSeconds: bounce.atSeconds,
        frequencyHz: vary(8300, 0.08),
        durationSeconds: 0.04,
        gain: bounce.gain * 0.5 * params.volume,
      },
      kit,
    )
    playNoiseBurst(
      {
        atSeconds: bounce.atSeconds,
        durationSeconds: 0.03,
        gain: bounce.gain * 0.6 * params.volume,
        filters: [{ type: "bandpass", frequencyHz: 900, q: 1 }],
      },
      kit,
    )
  }
}

/**
 * Packing tape peeling off a dispenser gun: stick-slip screech in a few
 * resonant bands, with the stick-slip rate rising as the pull speeds up,
 * then the serrated blade cutting it.
 */
function playTapeGun(params: { volume: number }, kit: AudioKit): void {
  const { audio } = kit
  const startSeconds = audio.currentTime
  const pullSeconds = 1.25
  const source = audio.createBufferSource()
  source.buffer = kit.noise
  source.loop = true
  const screech = audio.createGain()
  screech.gain.value = 0
  for (const [frequencyHz, q] of [
    [1700, 6],
    [3100, 8],
    [5200, 6],
  ]) {
    const band = connectFilters(
      { from: source, filters: [{ type: "bandpass", frequencyHz, q }] },
      kit,
    )
    band.connect(screech)
  }
  // Stick-slip: the tape grabs and lets go dozens of times a second.
  const stickSlip = audio.createOscillator()
  stickSlip.type = "sawtooth"
  stickSlip.frequency.setValueAtTime(55, startSeconds)
  stickSlip.frequency.linearRampToValueAtTime(120, startSeconds + pullSeconds)
  const stickSlipDepth = audio.createGain()
  stickSlipDepth.gain.value = 0.6
  stickSlip.connect(stickSlipDepth).connect(screech.gain)
  const envelope = audio.createGain()
  envelope.gain.setValueAtTime(0.0001, startSeconds)
  envelope.gain.exponentialRampToValueAtTime(
    0.9 * params.volume,
    startSeconds + 0.06,
  )
  envelope.gain.setValueAtTime(
    0.9 * params.volume,
    startSeconds + pullSeconds - 0.1,
  )
  envelope.gain.exponentialRampToValueAtTime(0.0001, startSeconds + pullSeconds)
  screech.connect(envelope).connect(kit.operatorBus)
  source.start(startSeconds, Math.random())
  stickSlip.start(startSeconds)
  source.stop(startSeconds + pullSeconds + 0.05)
  stickSlip.stop(startSeconds + pullSeconds + 0.05)
  // Roller rumble under the screech.
  playNoiseBurst(
    {
      durationSeconds: pullSeconds,
      gain: 0.12 * params.volume,
      attackSeconds: 0.1,
      filters: [{ type: "lowpass", frequencyHz: 350 }],
    },
    kit,
  )
  // The blade: a short rip and a knock as the gun is rocked over.
  playNoiseBurst(
    {
      atSeconds: pullSeconds + 0.05,
      durationSeconds: 0.06,
      gain: 0.5 * params.volume,
      filters: [{ type: "highpass", frequencyHz: 2000 }],
    },
    kit,
  )
  playNoiseBurst(
    {
      atSeconds: pullSeconds + 0.08,
      durationSeconds: 0.1,
      gain: 0.4 * params.volume,
      filters: [{ type: "lowpass", frequencyHz: 400 }],
    },
    kit,
  )
}

/** Cardboard: a papery slap over a low body thump. */
function playCardboardThump(
  params: { volume: number; atSeconds?: number; sizeScale: number },
  kit: AudioKit,
): void {
  const { volume, sizeScale } = params
  const atSeconds = params.atSeconds ?? 0
  playNoiseBurst(
    {
      atSeconds,
      durationSeconds: 0.12 * sizeScale,
      gain: 0.55 * volume,
      filters: [{ type: "lowpass", frequencyHz: 260 / sizeScale }],
    },
    kit,
  )
  playNoiseBurst(
    {
      atSeconds,
      durationSeconds: 0.05,
      gain: 0.18 * volume,
      filters: [{ type: "bandpass", frequencyHz: vary(1300), q: 0.8 }],
    },
    kit,
  )
}

/** Cardboard creasing: sparse crackles as the fibres give, rising to the fold. */
function playCardboardCrease(
  params: { volume: number; durationSeconds: number },
  kit: AudioKit,
): void {
  const crackleCount = Math.round(params.durationSeconds * 40)
  for (let index = 0; index < crackleCount; index++)
    playNoiseBurst(
      {
        atSeconds:
          (index / crackleCount) * params.durationSeconds +
          Math.random() * 0.02,
        durationSeconds: vary(0.015, 0.5),
        gain: vary(0.07, 0.6) * params.volume,
        filters: [{ type: "bandpass", frequencyHz: vary(1600, 0.5), q: 1.5 }],
      },
      kit,
    )
}

/** Light PLA spacers tipping out of a tub or off a flexed plate: a short run of distinct plastic clacks. */
function playSpacerPour(params: { volume: number }, kit: AudioKit): void {
  const durationSeconds = 1.1
  for (let index = 0; index < 22; index++) {
    // Bunched in the middle of the pour, thinning out at the end.
    const position = (Math.random() + Math.random()) / 2
    const atSeconds = position * durationSeconds
    const gain = vary(0.09, 0.5) * params.volume
    // A hollow "tok" of a 42 mm PLA part, with a tiny click on contact.
    playPing(
      {
        atSeconds,
        frequencyHz: vary(1250, 0.35),
        durationSeconds: vary(0.035, 0.3),
        gain,
        type: "triangle",
      },
      kit,
    )
    playNoiseBurst(
      {
        atSeconds,
        durationSeconds: 0.006,
        gain: gain * 0.6,
        filters: [{ type: "bandpass", frequencyHz: vary(3000, 0.2), q: 2 }],
      },
      kit,
    )
  }
}

/** Epson inkjet printing one sheet: pick roller, carriage passes with their stepper whine and soft end stops, then the eject. */
function playInkjetSheet(params: { volume: number }, kit: AudioKit): void {
  const { volume } = params
  const roomBus = "room" as const
  playPing(
    {
      frequencyHz: 95,
      endFrequencyHz: 130,
      durationSeconds: 0.5,
      gain: 0.05 * volume,
      type: "sawtooth",
      attackSeconds: 0.05,
      filters: [{ type: "lowpass", frequencyHz: 600 }],
      bus: roomBus,
    },
    kit,
  )
  for (let pass = 0; pass < 9; pass++) {
    const atSeconds = 0.6 + pass * 0.32
    playPing(
      {
        atSeconds,
        frequencyHz: pass % 2 ? 470 : 520,
        durationSeconds: 0.24,
        gain: 0.03 * volume,
        type: "triangle",
        attackSeconds: 0.03,
        bus: roomBus,
      },
      kit,
    )
    playPing(
      {
        atSeconds: atSeconds + 0.26,
        frequencyHz: 220,
        durationSeconds: 0.04,
        gain: 0.04 * volume,
        bus: roomBus,
      },
      kit,
    )
  }
  playPing(
    {
      atSeconds: 3.6,
      frequencyHz: 120,
      endFrequencyHz: 90,
      durationSeconds: 0.45,
      gain: 0.04 * volume,
      type: "sawtooth",
      attackSeconds: 0.05,
      filters: [{ type: "lowpass", frequencyHz: 500 }],
      bus: roomBus,
    },
    kit,
  )
}

export function playCueSound(
  params: { cue: SoundCue; volume: number },
  kit: AudioKit,
): void {
  const { volume } = params
  switch (params.cue) {
    case "usb_click":
      playUsbClick({ volume }, kit)
      return
    case "jst_click":
      playJstClick({ volume }, kit)
      return
    case "plug_pull":
      playNoiseBurst(
        {
          durationSeconds: 0.08,
          gain: 0.08 * volume,
          attackSeconds: 0.01,
          filters: [{ type: "bandpass", frequencyHz: 3800, q: 1.2 }],
        },
        kit,
      )
      playNoiseBurst(
        {
          atSeconds: 0.03,
          durationSeconds: 0.015,
          gain: 0.2 * volume,
          filters: [{ type: "bandpass", frequencyHz: 2400, q: 2 }],
        },
        kit,
      )
      return
    case "board_chirp":
      // BZ1, a 9 mm magnetic buzzer near its 2.7 kHz resonance: two short beeps.
      for (const atSeconds of [0, 0.14])
        playPing(
          {
            atSeconds,
            frequencyHz: 2700,
            durationSeconds: 0.1,
            gain: 0.1 * volume,
            type: "square",
            attackSeconds: 0.004,
            filters: [{ type: "bandpass", frequencyHz: 2700, q: 6 }],
          },
          kit,
        )
      return
    case "qc_pass":
      // Laptop notification: a soft two-note bell.
      for (const [atSeconds, frequencyHz] of [
        [0, 1046.5],
        [0.11, 1568],
      ]) {
        playPing(
          { atSeconds, frequencyHz, durationSeconds: 0.6, gain: 0.07 * volume },
          kit,
        )
        playPing(
          {
            atSeconds,
            frequencyHz: frequencyHz * 2.76,
            durationSeconds: 0.15,
            gain: 0.015 * volume,
          },
          kit,
        )
      }
      return
    case "box_close":
      playCardboardCrease({ volume: volume * 0.6, durationSeconds: 0.35 }, kit)
      playCardboardThump({ volume, atSeconds: 0.4, sizeScale: 0.8 }, kit)
      playCardboardThump(
        { volume: volume * 0.5, atSeconds: 0.75, sizeScale: 0.6 },
        kit,
      )
      return
    case "flap_fold":
      playCardboardCrease({ volume, durationSeconds: 0.5 }, kit)
      playCardboardThump({ volume, atSeconds: 0.55, sizeScale: 1.4 }, kit)
      return
    case "tape_gun":
      playTapeGun({ volume }, kit)
      return
    case "label_printer":
      playInkjetSheet({ volume }, kit)
      return
    case "print_done":
      // Bambu Lab finish tone, from across the room.
      for (const [atSeconds, frequencyHz] of [
        [0, 1318.5],
        [0.16, 1568],
        [0.32, 2093],
      ])
        playPing(
          {
            atSeconds,
            frequencyHz,
            durationSeconds: 0.2,
            gain: 0.06 * volume,
            type: "triangle",
            bus: "room",
          },
          kit,
        )
      return
    case "screw_drop":
      playScrewDrop({ volume }, kit)
      return
    case "pour_spacers":
      playSpacerPour({ volume }, kit)
      return
  }
}
