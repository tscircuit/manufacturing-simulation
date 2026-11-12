import type { CameraMode } from "lib/viewer/camera-rig"

const CAMERA_BUTTONS: Array<{ mode: CameraMode; label: string }> = [
  { mode: "overview", label: "Overview" },
  { mode: "follow", label: "Follow" },
  { mode: "close_up", label: "Close-up" },
]

export function CameraBar(props: {
  cameraMode: CameraMode
  isAutoCloseUp: boolean
  onCameraModeChange: (mode: CameraMode) => void
  onAutoCloseUpChange: (isAutoCloseUp: boolean) => void
}) {
  return (
    <div className="cam">
      {CAMERA_BUTTONS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={props.cameraMode === mode}
          onClick={() => props.onCameraModeChange(mode)}
        >
          {label}
        </button>
      ))}
      <label>
        <input
          type="checkbox"
          checked={props.isAutoCloseUp}
          onChange={(event) => props.onAutoCloseUpChange(event.target.checked)}
        />
        Auto close-up
      </label>
    </div>
  )
}
