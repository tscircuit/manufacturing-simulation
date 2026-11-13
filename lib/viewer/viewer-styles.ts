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
.msim .tot .stages { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px 6px; margin-bottom: 4px; }
.msim .tot .stage-cell { font-size: 12px; color: var(--muted); white-space: nowrap; }
.msim .tot .stage-cell b { color: var(--fg, inherit); }
.msim ol.rows .count { font-family: var(--mono); font-size: 11px; color: var(--muted); font-weight: 400; }
.msim .bottom { position: absolute; left: max(16px, env(safe-area-inset-left, 0px)); right: max(16px, env(safe-area-inset-right, 0px)); bottom: calc(12px + env(safe-area-inset-bottom, 0px)); display: flex; gap: 8px; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; pointer-events: none; }
.msim .bottom > * { pointer-events: auto; }
.msim .status { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 7px 11px; min-width: 0; max-width: 520px; flex: 1 1 240px; }
.msim .status .now { font-weight: 600; }
.msim .status .hint { color: var(--muted); font-size: 11.5px; }
.msim .status .prompt { margin-top: 3px; display: flex; gap: 4px 12px; flex-wrap: wrap; }
.msim .prompt-action { background: none; border: 0; padding: 0; color: inherit; text-align: left; font: inherit; }
.msim .prompt-action:hover { text-decoration: underline; }
.msim kbd { font-family: var(--mono); font-size: 11px; background: var(--accent); color: var(--accent-fg); border-radius: 3px; padding: 1px 5px; font-weight: 600; }
.msim .cam { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 6px; display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
.msim .cam label { display: flex; gap: 5px; align-items: center; color: var(--muted); padding: 0 4px; }
@media (max-width: 720px) {
  .msim:not(.touch) .timing { top: auto; bottom: calc(150px + env(safe-area-inset-bottom, 0px)); max-height: 45%; }
  .msim:not(.touch) .panel { max-height: 55%; }
}

/* Touch screens: folded tabs at the top, a short status line between them, the walk stick and action buttons in the thumb corners. */
.msim.touch { --safe-top: env(safe-area-inset-top, 0px); --safe-bottom: env(safe-area-inset-bottom, 0px); --safe-left: env(safe-area-inset-left, 0px); --safe-right: env(safe-area-inset-right, 0px); }
.msim.touch button, .msim.touch select { min-height: 40px; }
.msim.touch .panel { top: calc(8px + var(--safe-top)); max-height: calc(100% - 150px - var(--safe-top) - var(--safe-bottom)); z-index: 3; }
.msim.touch .ctl { left: calc(8px + var(--safe-left)); width: auto; }
.msim.touch .timing { right: calc(8px + var(--safe-right)); width: auto; }
.msim.touch .ctl:has(details[open]) { width: min(330px, calc(100% - 16px - var(--safe-left) - var(--safe-right))); }
.msim.touch .timing:has(details[open]) { width: min(330px, calc(100% - 16px - var(--safe-left) - var(--safe-right))); }
.msim.touch summary { padding: 8px 10px; min-height: 40px; align-items: center; }
.msim.touch .ctl details:not([open]) summary .eyebrow { display: none; }
.msim.touch .ctl details:not([open]) summary br { display: none; }
.msim.touch ol.rows { max-height: none; min-height: 0; }
.msim.touch .cam { border: 0; padding: 0; background: none; }
.msim.touch .bottom { top: calc(8px + var(--safe-top)); bottom: auto; left: 50%; right: auto; transform: translateX(-50%); width: min(480px, calc(100% - 330px)); justify-content: center; z-index: 2; }
.msim.touch .status { max-width: none; padding: 6px 10px; }
.msim.touch .status .now { font-size: 12.5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.msim.touch .status .hint { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.msim.touch .prompt-action { background: var(--btn); border: 1px solid var(--line); border-radius: 18px; padding: 5px 10px; min-height: 36px; font-size: 12.5px; }
.msim.touch .prompt-action:hover { text-decoration: none; }
.msim .stick-zone { position: absolute; left: 0; top: 0; bottom: 0; width: 50%; z-index: 1; touch-action: none; }
.msim .stick { position: absolute; width: 112px; height: 112px; border-radius: 50%; background: rgba(255,255,255,.28); border: 2px solid rgba(255,255,255,.75); box-shadow: 0 2px 10px rgba(0,0,0,.18); pointer-events: none; }
.msim .knob { position: absolute; left: 32px; top: 32px; width: 44px; height: 44px; border-radius: 50%; background: var(--accent); box-shadow: 0 2px 6px rgba(0,0,0,.25); }
.msim .stick-hint { position: absolute; left: calc(20px + var(--safe-left, 0px)); bottom: calc(22px + var(--safe-bottom, 0px)); padding: 6px 10px; border-radius: 14px; background: var(--panel); color: var(--muted); font-size: 12px; pointer-events: none; opacity: .85; }
.msim .touch-message { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 5; padding: 10px 16px; border-radius: 20px; background: var(--panel); border: 1px solid var(--line); font-weight: 600; box-shadow: 0 4px 14px rgba(0,0,0,.2); pointer-events: none; }
.msim .touch-actions { position: absolute; right: calc(16px + var(--safe-right, 0px)); bottom: calc(16px + var(--safe-bottom, 0px)); display: flex; flex-wrap: wrap-reverse; justify-content: flex-end; align-items: flex-end; gap: 10px; max-width: calc(100% - 170px); z-index: 2; touch-action: manipulation; }
.msim .touch-button { border-radius: 50%; display: grid; place-items: center; padding: 0; font-weight: 700; box-shadow: 0 2px 6px rgba(0,0,0,.18); }
.msim .touch-button.small { width: 52px; height: 52px; background: var(--panel); font-size: 12px; }
.msim .touch-button.main { width: 76px; height: 76px; background: var(--accent); color: var(--accent-fg); border-color: var(--accent); font-size: 24px; }
.msim .touch-button:disabled { opacity: .45; }
.msim .rotate-tip { position: absolute; left: 50%; bottom: calc(150px + var(--safe-bottom, 0px)); transform: translateX(-50%); z-index: 4; border-radius: 20px; padding: 8px 14px; background: var(--panel); white-space: nowrap; font-size: 12.5px; }
@media (orientation: landscape) and (max-height: 500px) {
  .msim.touch .panel { max-height: calc(100% - 16px - var(--safe-top) - var(--safe-bottom)); }
  .msim.touch .status .hint { display: none; }
  .msim.touch .status .prompt { flex-wrap: nowrap; overflow-x: auto; }
}
@media (orientation: portrait) {
  .msim.touch .bottom { top: calc(60px + var(--safe-top)); left: calc(8px + var(--safe-left)); right: calc(8px + var(--safe-right)); width: auto; transform: none; }
}
`
