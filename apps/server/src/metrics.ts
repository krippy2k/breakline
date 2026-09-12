export class Metrics {
  private readonly counters = new Map<string, number>();
  private readonly observations = new Map<string, number[]>();

  increment(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  observe(name: string, value: number): void {
    const list = this.observations.get(name) ?? [];
    list.push(value);
    this.observations.set(name, list);
  }

  snapshot(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [name, value] of this.counters) {
      out[name] = value;
    }
    for (const [name, values] of this.observations) {
      out[`${name}_count`] = values.length;
      out[`${name}_last`] = values.at(-1) ?? 0;
    }
    return out;
  }
}
