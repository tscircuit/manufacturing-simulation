import { ManufacturingSimulationViewer } from "lib/viewer/manufacturing-simulation-viewer"

/**
 * Second line on the same unit 322 floor: the bare NEMA17 + RP2040 controller,
 * tested, then sealed in a 4" x 6" ESD bag with a tscircuit sticker and an
 * Amazon FNSKU label, 30 bags to an FBA carton.
 */
export default () => <ManufacturingSimulationViewer productLine="bagged" />
