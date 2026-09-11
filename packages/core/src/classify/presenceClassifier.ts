import type { BehaviorFunction } from "../types.js";
import { symbolOf, toChangeLocation } from "./helpers.js";
import type { Change, ClassifyInput } from "./types.js";

export function classifyPresence(input: ClassifyInput): Change[] {
  return [
    ...input.added.map((fn) => presenceChange(fn, "function_added")),
    ...input.removed.map((fn) => presenceChange(fn, "function_removed")),
  ];
}

function presenceChange(fn: BehaviorFunction, kind: "function_added" | "function_removed"): Change {
  return {
    kind,
    symbol: symbolOf(fn),
    location: toChangeLocation(fn.location),
    before: kind === "function_removed" ? symbolOf(fn) : undefined,
    after: kind === "function_added" ? symbolOf(fn) : undefined,
  };
}
