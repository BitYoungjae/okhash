export class FifoCache<Value> {
  readonly #limit: number;
  readonly #entries = new Map<string, Value>();

  constructor(limit: number) {
    this.#limit = limit;
  }

  get(key: string): Value | undefined {
    return this.#entries.get(key);
  }

  set(key: string, value: Value): void {
    if (this.#limit === 0) {
      return;
    }

    if (this.#entries.has(key)) {
      this.#entries.set(key, value);
      return;
    }

    if (this.#entries.size >= this.#limit) {
      const oldest = this.#entries.keys().next().value;
      if (oldest !== undefined) {
        this.#entries.delete(oldest);
      }
    }

    this.#entries.set(key, value);
  }
}
