export type {
  AnalysisResult,
  BehaviorAnalyzer,
  BehaviorDescription,
  BehaviorEffect,
  BehaviorExpression,
  BehaviorFinding,
  BehaviorFunction,
  BehaviorParameter,
  BehaviorPath,
  BehaviorValue,
  BehaviorWitness,
  CallEffect,
  Confidence,
  FindingEvidence,
  FindingType,
  InspectedFunction,
  ReturnEffect,
  SourceLocation,
  SymbolIdentity,
  ThrowEffect,
  WitnessSolver,
} from "./types.js";

export { inspectSource, inspectFile, compareSources, compareMany } from "./pipeline.js";
export { extractFunctions } from "./parser/extract-functions.js";
export { parseSource } from "./parser/parse.js";
export { normalizeExpression } from "./parser/normalize-expression.js";
export { buildBehaviorFunction } from "./ir/build-bir.js";
export { printExpression, printValue, printBindings } from "./ir/print.js";
export { compareFunctions } from "./compare/compare.js";
export { matchFunctions, symbolKey } from "./compare/match-functions.js";
export { BooleanEnumerator } from "./witness/boolean-enumerator.js";
export { NumericBoundarySolver } from "./witness/numeric-boundary.js";
export { CompositeWitnessSolver } from "./witness/composite.js";
export { evaluateExpression } from "./witness/evaluate.js";
export { PredicateAnalyzer } from "./analysis/predicate.js";
export { BoundaryAnalyzer } from "./analysis/boundary.js";
export { ReturnAnalyzer } from "./analysis/return.js";
export { ExceptionAnalyzer } from "./analysis/exception.js";
export { ReachabilityAnalyzer } from "./analysis/reachability.js";
