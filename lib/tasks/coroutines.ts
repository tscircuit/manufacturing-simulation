/**
 * A simulation task is a generator that is resumed once per simulation step
 * with that step's elapsed seconds. Yielding hands control back until the
 * next step.
 */
export type SimTask = Generator<void, void, number>

export const smoothstep = (t: number) => t * t * (3 - 2 * t)

export function* waitSeconds(seconds: number): SimTask {
  let remainingSeconds = seconds
  while (remainingSeconds > 0) remainingSeconds -= yield
}

/** Call `onProgress` with eased progress 0..1 over `durationSeconds`. */
export function* tween(params: {
  durationSeconds: number
  onProgress: (easedProgress: number) => void
}): SimTask {
  const { durationSeconds, onProgress } = params
  let elapsedSeconds = 0
  onProgress(0)
  while (elapsedSeconds < durationSeconds) {
    elapsedSeconds += yield
    onProgress(smoothstep(Math.min(1, elapsedSeconds / durationSeconds)))
  }
}

/** Run tasks side by side until all of them finish. */
export function* runInParallel(tasks: SimTask[]): SimTask {
  let runningTasks = tasks.filter((task) => !task.next().done)
  while (runningTasks.length > 0) {
    const dtSeconds = yield
    runningTasks = runningTasks.filter((task) => !task.next(dtSeconds).done)
  }
}
