import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import BareUnitBaggingPage from "../pages/bare-unit-bagging.page"
import ManufacturingSimulationPage from "../pages/manufacturing-simulation.page"

const root = document.getElementById("root")
if (!root) throw new Error("Missing root element")

// `?line=bagged` (or <meta name="manufacturing-line" content="bagged">) opens the
// bare-unit bagging line; the full kit line is the default.
// A single-file preview can't carry a query string, so it can say so in a meta tag instead.
const isBaggedLine =
  new URLSearchParams(window.location.search).get("line") === "bagged" ||
  document
    .querySelector('meta[name="manufacturing-line"]')
    ?.getAttribute("content") === "bagged"

createRoot(root).render(
  <StrictMode>
    <div style={{ height: "100vh" }}>
      {isBaggedLine ? <BareUnitBaggingPage /> : <ManufacturingSimulationPage />}
    </div>
  </StrictMode>,
)
