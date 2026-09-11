export interface SourcePosition {
  line: number;
  column: number;
}

export interface SourceLocation {
  file: string;
  start: SourcePosition;
  end: SourcePosition;
}

export interface SymbolIdentity {
  file: string;
  container?: string;
  name: string;
  kind: "function" | "method" | "arrow-function";
}

export interface BehaviorParameter {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
}

export interface SignatureParameter {
  name: string;
  type?: string;
  optional: boolean;
  rest: boolean;
  defaultValue?: string;
}

export interface FunctionSignature {
  async: boolean;
  returnType?: string;
  parameters: SignatureParameter[];
}

export type BehaviorValue =
  | { kind: "identifier"; name: string }
  | { kind: "literal"; value: boolean | number | string | null }
  | { kind: "property"; object: BehaviorValue; name: string }
  | { kind: "unknown"; text?: string };

export interface ComparisonExpression {
  kind: "comparison";
  operator: "==" | "===" | "!=" | "!==" | ">" | ">=" | "<" | "<=";
  left: BehaviorValue;
  right: BehaviorValue;
}

export interface LogicalExpression {
  kind: "logical";
  operator: "and" | "or";
  left: BehaviorExpression;
  right: BehaviorExpression;
}

export interface NegationExpression {
  kind: "not";
  expression: BehaviorExpression;
}

export interface BooleanExpression {
  kind: "boolean";
  value: BehaviorValue;
}

export interface ThrowsExpression {
  kind: "throws";
  callee: string;
}

export type BehaviorExpression =
  | BooleanExpression
  | ComparisonExpression
  | LogicalExpression
  | NegationExpression
  | ThrowsExpression;

export interface ReturnEffect {
  kind: "return";
  value?: BehaviorValue;
}

export interface ThrowEffect {
  kind: "throw";
  value?: BehaviorValue;
}

export interface CallEffect {
  kind: "call";
  callee: string;
  args?: BehaviorValue[];
  inTry?: boolean;
  onCatch?: boolean;
}

export type BehaviorEffect = ReturnEffect | ThrowEffect | CallEffect;

export interface BehaviorPath {
  conditions: BehaviorExpression[];
  effects: BehaviorEffect[];
}

export interface BehaviorFunction {
  id: string;
  name: string;
  file: string;
  identity: SymbolIdentity;
  parameters: BehaviorParameter[];
  signature: FunctionSignature;
  paths: BehaviorPath[];
  branchPredicates: BehaviorExpression[];
  location?: SourceLocation;
}

export type FindingType =
  | "predicate-expanded"
  | "predicate-restricted"
  | "predicate-changed"
  | "boundary-changed"
  | "return-changed"
  | "return-added"
  | "return-removed"
  | "throw-added"
  | "throw-removed"
  | "call-newly-reachable"
  | "call-no-longer-reachable"
  | "call-became-unconditional";

export type Confidence = "high" | "medium" | "low";

export interface BehaviorDescription {
  text: string;
  expression?: BehaviorExpression;
  value?: BehaviorValue;
}

export interface BehaviorWitness {
  bindings: Record<string, boolean | number | string | null>;
  before?: string;
  after?: string;
}

export interface FindingEvidence {
  kind: "predicate" | "return" | "throw" | "call" | "control-flow";
  before?: unknown;
  after?: unknown;
  source?: SourceLocation;
}

export interface BehaviorFinding {
  type: FindingType;
  confidence: Confidence;
  file: string;
  symbol: string;
  location?: SourceLocation;
  summary: string;
  before?: BehaviorDescription;
  after?: BehaviorDescription;
  witness?: BehaviorWitness;
  evidence: FindingEvidence[];
}

export interface BehaviorAnalyzer {
  analyze(before: BehaviorFunction, after: BehaviorFunction): BehaviorFinding[];
}

export interface WitnessSolver {
  findDifference(
    before: BehaviorExpression,
    after: BehaviorExpression,
  ): Promise<BehaviorWitness | null>;
}

export interface InspectedFunction {
  identity: SymbolIdentity;
  parameters: BehaviorParameter[];
  location: SourceLocation;
}

export interface AnalysisResult {
  filesAnalyzed: number;
  functionsCompared: number;
  findings: BehaviorFinding[];
  changes?: import("./classify/types.js").Change[];
  report?: import("./findings/types.js").Finding[];
  files?: string[];
  impact?: import("./impact/types.js").ImpactReport;
}
