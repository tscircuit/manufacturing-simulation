/** Binary min-heap of grid cell indices keyed by priority, used by A*. */
export class MinHeap {
  private priorities: number[] = []
  private cellIndices: number[] = []

  get size(): number {
    return this.cellIndices.length
  }

  push(params: { priority: number; cellIndex: number }): void {
    this.priorities.push(params.priority)
    this.cellIndices.push(params.cellIndex)
    let child = this.cellIndices.length - 1
    while (child > 0) {
      const parent = (child - 1) >> 1
      if (this.priorities[parent] <= this.priorities[child]) break
      this.swap(parent, child)
      child = parent
    }
  }

  pop(): number | undefined {
    const top = this.cellIndices[0]
    const lastPriority = this.priorities.pop()
    const lastCellIndex = this.cellIndices.pop()
    if (this.cellIndices.length === 0) return top
    this.priorities[0] = lastPriority as number
    this.cellIndices[0] = lastCellIndex as number
    let parent = 0
    for (;;) {
      const left = parent * 2 + 1
      const right = left + 1
      let smallest = parent
      if (
        left < this.priorities.length &&
        this.priorities[left] < this.priorities[smallest]
      ) {
        smallest = left
      }
      if (
        right < this.priorities.length &&
        this.priorities[right] < this.priorities[smallest]
      ) {
        smallest = right
      }
      if (smallest === parent) break
      this.swap(parent, smallest)
      parent = smallest
    }
    return top
  }

  private swap(a: number, b: number): void {
    ;[this.priorities[a], this.priorities[b]] = [
      this.priorities[b],
      this.priorities[a],
    ]
    ;[this.cellIndices[a], this.cellIndices[b]] = [
      this.cellIndices[b],
      this.cellIndices[a],
    ]
  }
}
