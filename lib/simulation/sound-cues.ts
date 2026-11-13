import type { SimContext } from "lib/simulation/sim-context"

/** One-off sounds the simulation asks for; the viewer synthesizes them. Continuous sounds (footsteps, the screwdriver, a spinning motor) are read from the scene instead. */
export type SoundCue =
  | "plug_click"
  | "plug_pull"
  | "board_chirp"
  | "qc_pass"
  | "box_close"
  | "flap_fold"
  | "tape_gun"
  | "label_printer"
  | "print_done"
  | "screw_drop"
  | "pour_spacers"

/** Keep only recent cues when nothing drains the queue, e.g. in headless runs. */
const MAX_QUEUED_CUES = 32

export function playCue(cue: SoundCue, ctx: SimContext): void {
  ctx.soundCues.push(cue)
  if (ctx.soundCues.length > MAX_QUEUED_CUES)
    ctx.soundCues.splice(0, ctx.soundCues.length - MAX_QUEUED_CUES)
}
