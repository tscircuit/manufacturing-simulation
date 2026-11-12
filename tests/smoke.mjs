// Loads index.html in headless Chromium and runs the full assemble-and-pack job
// at a fixed time step. Fails on any page error or if the job does not finish.
import { chromium } from "playwright"

const page_url = new URL("../index.html", import.meta.url).href
const browser = await chromium.launch({
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on("pageerror", (e) => errors.push(e.message))
await page.goto(page_url)
await page.waitForFunction(() => window.__sim, null, { timeout: 30000 })

const result = await page.evaluate(() => {
  const s = window.__sim
  s.resetWorld()
  s.start(s.scJob())
  for (let k = 0; k < 20000 && s.task; k++) s.step(0.02)
  return { done: s.W.jobDone, total: s.W.jobT, steps: s.W.times }
})
await browser.close()

console.log(`cycle ${result.total.toFixed(1)} s`, result.steps.map((t) => t.toFixed(1)).join(" "))
if (errors.length) throw new Error("page errors:\n" + errors.join("\n"))
if (!result.done) throw new Error("assemble-and-pack job did not finish")
console.log("ok")
