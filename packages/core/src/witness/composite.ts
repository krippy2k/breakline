import type { BehaviorExpression, BehaviorWitness, WitnessSolver } from "../types.js";
import { BooleanEnumerator } from "./boolean-enumerator.js";
import { MixedWitnessSolver } from "./mixed-solver.js";
import { NumericBoundarySolver } from "./numeric-boundary.js";

export class CompositeWitnessSolver implements WitnessSolver {
  private readonly solvers: WitnessSolver[];

  constructor(solvers?: WitnessSolver[]) {
    this.solvers = solvers ?? [
      new BooleanEnumerator(),
      new NumericBoundarySolver(),
      new MixedWitnessSolver(),
    ];
  }

  async findDifference(
    before: BehaviorExpression,
    after: BehaviorExpression,
  ): Promise<BehaviorWitness | null> {
    for (const solver of this.solvers) {
      const witness = await solver.findDifference(before, after);
      if (witness) {
        return witness;
      }
    }
    return null;
  }
}
