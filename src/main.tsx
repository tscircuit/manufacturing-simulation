import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import ManufacturingSimulationPage from "../pages/manufacturing-simulation.page"

const root = document.getElementById("root")
if (!root) throw new Error("Missing root element")

createRoot(root).render(
  <StrictMode>
    <div style={{ height: "100vh" }}>
      <ManufacturingSimulationPage />
    </div>
  </StrictMode>,
)
