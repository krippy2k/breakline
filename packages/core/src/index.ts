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
  FunctionSignature,
  InspectedFunction,
  ReturnEffect,
  SignatureParameter,
  SourceLocation,
  SymbolIdentity,
  ThrowEffect,
  WitnessSolver,
} from "./types.js";

export type { Change, ChangeKind, ChangeLocation, ClassifyInput } from "./classify/types.js";
export type { Finding, FindingSeverity } from "./findings/types.js";
export type { JsonReport, JsonImpact } from "./output/json.js";
export type {
  ChangeImpact,
  CodeSymbol,
  DependencyEdge,
  DependencyKind,
  ImpactLevel,
  ImpactOptions,
  ImpactReport,
  SymbolId,
  SymbolKind,
} from "./impact/types.js";

export { inspectSource, inspectFile, compareSources, compareMany } from "./pipeline.js";
export { extractFunctions } from "./parser/extract-functions.js";
export { parseSource } from "./parser/parse.js";
export { normalizeExpression } from "./parser/normalize-expression.js";
export { buildBehaviorFunction } from "./ir/build-bir.js";
export { printExpression, printValue, printBindings } from "./ir/print.js";
export { compareFunctions } from "./compare/compare.js";
export { matchFunctions, matchFunctionsDetailed, symbolKey } from "./compare/match-functions.js";
export { classifyChanges } from "./classify/classifyChanges.js";
export { classifySignature } from "./classify/signatureClassifier.js";
export { classifyConditions } from "./classify/conditionClassifier.js";
export { classifyReturns } from "./classify/returnClassifier.js";
export { classifyCalls } from "./classify/callClassifier.js";
export { classifyExceptions } from "./classify/exceptionClassifier.js";
export { createFindings } from "./findings/createFindings.js";
export { findingId } from "./findings/findingId.js";
export { formatTextReport } from "./output/text.js";
export { formatAnalysisText } from "./output/impact-text.js";
export { formatJsonReport, toJsonReport, JSON_SCHEMA_VERSION } from "./output/json.js";
export { DependencyGraph } from "./impact/graph.js";
export { SymbolIndex } from "./impact/symbol-index.js";
export { buildImpactGraph } from "./impact/builder.js";
export { analyzeImpact, attachImpact } from "./impact/analyzer.js";
export { findImpact } from "./impact/traversal.js";
export { loadProjectSources, discoverSourceFiles } from "./impact/discover.js";
export { DEFAULT_IMPACT_OPTIONS } from "./impact/types.js";
export { BooleanEnumerator } from "./witness/boolean-enumerator.js";
export { NumericBoundarySolver } from "./witness/numeric-boundary.js";
export { CompositeWitnessSolver } from "./witness/composite.js";
export { evaluateExpression } from "./witness/evaluate.js";
export { PredicateAnalyzer } from "./analysis/predicate.js";
export { BoundaryAnalyzer } from "./analysis/boundary.js";
export { ReturnAnalyzer } from "./analysis/return.js";
export { ExceptionAnalyzer } from "./analysis/exception.js";
export { ReachabilityAnalyzer } from "./analysis/reachability.js";
