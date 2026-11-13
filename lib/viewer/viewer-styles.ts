/** Styles for the viewer, scoped under `.msim`. Colors are theme tokens. */
export const VIEWER_STYLES = `
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;700&family=Montserrat:wght@500;700;800&display=swap");

.msim {
  --bg: #e7ebee; --panel: rgba(255,255,255,.9); --fg: #18212b; --muted: #5a6876; --line: #c9d1d9;
  --accent: #b35f00; --accent-fg: #fff; --ok: #1d7f4f; --btn: #f3f5f7;
  --scene-bg: #dfe5ea; --floor: #c9cfd4; --floor-line: #b4bcc3; --wall: #f2f4f5;
  --sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
  position: relative; width: 100%; height: 100%; overflow: hidden;
  background: var(--bg); color: var(--fg); font-family: var(--sans); font-size: 13px; line-height: 1.4;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .msim {
    --bg: #0c1116; --panel: rgba(17,24,31,.9); --fg: #e4eaf0; --muted: #8a98a7; --line: #2a3541;
    --accent: #ffc533; --accent-fg: #1a1400; --ok: #58d39a; --btn: #1b2530;
    --scene-bg: #0c1116; --floor: #262e36; --floor-line: #35404b; --wall: #3a4550;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] .msim {
    --bg: #0c1116; --panel: rgba(17,24,31,.9); --fg: #e4eaf0; --muted: #8a98a7; --line: #2a3541;
    --accent: #ffc533; --accent-fg: #1a1400; --ok: #58d39a; --btn: #1b2530;
    --scene-bg: #0c1116; --floor: #262e36; --floor-line: #35404b; --wall: #3a4550;
    color-scheme: dark;
  }
.msim * { box-sizing: border-box; }
.msim canvas.msim-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; outline: none; }
.msim .panel { position: absolute; top: 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; backdrop-filter: blur(6px); max-height: calc(100% - 120px); overflow: auto; }
.msim .ctl { left: max(16px, env(safe-area-inset-left, 0px)); width: min(290px, calc(100% - 32px)); }
.msim .timing { right: max(16px, env(safe-area-inset-right, 0px)); width: min(300px, calc(100% - 32px)); }
.msim summary { cursor: pointer; padding: 9px 12px; font-weight: 600; display: flex; gap: 8px; align-items: baseline; justify-content: space-between; list-style: none; }
.msim summary::-webkit-details-marker { display: none; }
.msim summary::after { content: "▾"; color: var(--muted); font-size: 11px; }
.msim details:not([open]) summary::after { content: "▸"; }
.msim .eyebrow { font-family: var(--mono); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 500; }
.msim .body { padding: 2px 12px 12px; display: flex; flex-direction: column; gap: 10px; }
.msim .grp { display: flex; flex-direction: column; gap: 5px; }
.msim .row { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
.msim button, .msim select { font: inherit; color: var(--fg); background: var(--btn); border: 1px solid var(--line); border-radius: 4px; padding: 6px 9px; cursor: pointer; }
.msim button:hover { border-color: var(--muted); }
.msim button:focus-visible, .msim select:focus-visible, .msim summary:focus-visible, .msim canvas:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.msim button[aria-pressed="true"] { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); font-weight: 600; }
.msim .seg { display: grid; grid-template-columns: 1fr 1fr; }
.msim .seg button { border-radius: 0; }
.msim .seg button:first-child { border-radius: 4px 0 0 4px; }
.msim .seg button:last-child { border-radius: 0 4px 4px 0; border-left: 0; }
.msim .stack button { text-align: left; width: 100%; }
.msim .facts { font-family: var(--mono); font-size: 11px; color: var(--muted); display: grid; grid-template-columns: auto 1fr; gap: 1px 10px; margin: 0; }
.msim .facts dd { margin: 0; color: var(--fg); font-variant-numeric: tabular-nums; }
.msim ol.rows { list-style: none; margin: 0; padding: 0 12px; max-height: calc(100vh - 360px); min-height: 120px; overflow-y: auto; }
.msim ol.rows li { display: grid; grid-template-columns: 18px 1fr auto; gap: 6px; padding: 4px 0; border-top: 1px solid var(--line); color: var(--muted); }
.msim ol.rows .num { font-family: var(--mono); font-size: 11px; }
.msim ol.rows li.active { color: var(--fg); font-weight: 600; }
.msim ol.rows li.active .num { color: var(--accent); }
.msim ol.rows li.done { color: var(--fg); }
.msim ol.rows li.done .num { color: var(--ok); }
.msim .t { font-family: var(--mono); font-variant-numeric: tabular-nums; font-size: 12px; }
.msim .tot { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; padding: 8px 12px 11px; border-top: 1px solid var(--line); margin-top: 2px; }
.msim .tot b { font-weight: 600; }
.msim .tot .printer-line { grid-column: 1 / -1; color: var(--muted); font-size: 12px; }
.msim .tot .stage-cell { font-size: 12px; color: var(--muted); }
.msim .tot .stage-cell b { color: var(--fg, inherit); }
.msim .act.carry { bottom: calc(214px + env(safe-area-inset-bottom, 0px)); background: var(--panel, #fff); color: inherit; border-color: var(--line); }
.msim ol.rows .count { font-family: var(--mono); font-size: 11px; color: var(--muted); font-weight: 400; }
.msim .bottom { position: absolute; left: max(16px, env(safe-area-inset-left, 0px)); right: max(16px, env(safe-area-inset-right, 0px)); bottom: calc(12px + env(safe-area-inset-bottom, 0px)); display: flex; gap: 8px; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; pointer-events: none; }
.msim .bottom > * { pointer-events: auto; }
.msim .status { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 7px 11px; min-width: 0; max-width: 520px; flex: 1 1 240px; }
.msim .status .now { font-weight: 600; }
.msim .status .hint { color: var(--muted); font-size: 11.5px; }
.msim .status .prompt { margin-top: 3px; display: flex; gap: 12px; flex-wrap: wrap; }
.msim kbd { font-family: var(--mono); font-size: 11px; background: var(--accent); color: var(--accent-fg); border-radius: 3px; padding: 1px 5px; font-weight: 600; }
.msim .cam { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 6px; display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
.msim .cam label { display: flex; gap: 5px; align-items: center; color: var(--muted); padding: 0 4px; }
.msim .stick { position: absolute; left: max(20px, env(safe-area-inset-left, 0px)); bottom: calc(120px + env(safe-area-inset-bottom, 0px)); width: 104px; height: 104px; border-radius: 50%; background: var(--panel); border: 1px solid var(--line); touch-action: none; }
.msim .knob { position: absolute; left: 32px; top: 32px; width: 40px; height: 40px; border-radius: 50%; background: var(--accent); }
.msim .act { position: absolute; right: max(20px, env(safe-area-inset-right, 0px)); bottom: calc(130px + env(safe-area-inset-bottom, 0px)); width: 72px; height: 72px; border-radius: 50%; font-weight: 600; background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
@media (max-width: 720px) {
  .msim .timing { top: auto; bottom: calc(150px + env(safe-area-inset-bottom, 0px)); max-height: 45%; }
  .msim .panel { max-height: 55%; }
}
`
