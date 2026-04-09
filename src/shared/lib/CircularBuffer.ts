/**
 * CircularBuffer — Fixed-capacity ring buffer with O(1) append.
 *
 * Used for telemetry history: stores the last N samples without
 * memory allocation after initialization. When full, the oldest
 * sample is overwritten.
 */
export class CircularBuffer<T> {
  private buffer: T[];
  private head: number = 0;
  private count: number = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error(`CircularBuffer capacity must be positive, got ${capacity}`);
    }
    this.capacity = capacity;
    this.buffer = new Array<T>(capacity);
  }

  /** Add an item to the buffer. Overwrites the oldest item if full. */
  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /** Get all items in chronological order (oldest first). */
  toArray(): T[] {
    if (this.count === 0) return [];
    if (this.count < this.capacity) {
      return this.buffer.slice(0, this.count);
    }
    // Buffer is full: items from head to end, then start to head
    return [
      ...this.buffer.slice(this.head),
      ...this.buffer.slice(0, this.head),
    ];
  }

  /** Get the most recent item, or undefined if empty. */
  latest(): T | undefined {
    if (this.count === 0) return undefined;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[idx];
  }

  /** Get the number of items currently in the buffer. */
  size(): number {
    return this.count;
  }

  /** Check if the buffer is at full capacity. */
  isFull(): boolean {
    return this.count === this.capacity;
  }

  /** Get the maximum capacity. */
  getCapacity(): number {
    return this.capacity;
  }

  /** Clear all items. */
  clear(): void {
    this.head = 0;
    this.count = 0;
    this.buffer = new Array<T>(this.capacity);
  }
}
