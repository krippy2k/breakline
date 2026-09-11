import type { BehaviorFunction } from "../types.js";

export type ChangeKind =
  | "function_added"
  | "function_removed"
  | "signature_changed"
  | "return_changed"
  | "condition_changed"
  | "call_added"
  | "call_removed"
  | "call_arguments_changed"
  | "throw_added"
  | "throw_removed";

export interface ChangeLocation {
  file: string;
  line?: number;
  column?: number;
}

export interface Change {
  kind: ChangeKind;
  symbol?: string;
  before?: unknown;
  after?: unknown;
  location?: ChangeLocation;
}

export interface ChangeClassifier {
  classify(input: ClassifyInput): Change[];
}

export interface ClassifyInput {
  pairs: { before: BehaviorFunction; after: BehaviorFunction }[];
  added: BehaviorFunction[];
  removed: BehaviorFunction[];
}
