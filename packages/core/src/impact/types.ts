export type SymbolKind =
  | "function"
  | "method"
  | "class"
  | "interface"
  | "type"
  | "variable"
  | "route"
  | "event-handler"
  | "cli-command"
  | "test"
  | "unknown";

export interface SymbolId {
  file: string;
  qualifiedName: string;
}

export interface CodeSymbol {
  id: SymbolId;
  name: string;
  qualifiedName: string;
  kind: SymbolKind;
  file: string;
  startLine: number;
  endLine: number;
  exported: boolean;
  isEntryPoint?: boolean;
  isTest?: boolean;
  metadata?: Record<string, unknown>;
}

export type DependencyKind =
  | "calls"
  | "imports"
  | "extends"
  | "implements"
  | "reads"
  | "writes"
  | "registers"
  | "references";

export interface DependencyEdge {
  from: SymbolId;
  to: SymbolId;
  kind: DependencyKind;
  confidence: number;
  sourceLocation?: {
    file: string;
    line: number;
    column?: number;
  };
}

export interface ImpactReference {
  symbol: CodeSymbol;
  distance: number;
  path?: SymbolId[];
  relation?: DependencyKind;
  confidence: number;
}

export type EntryPointKind =
  | "http-route"
  | "event-handler"
  | "cli-command"
  | "export"
  | "public-api"
  | "unknown";

export interface EntryPointImpact extends ImpactReference {
  entryPointKind: EntryPointKind;
}

export interface TestImpact extends ImpactReference {
  testName?: string;
  gap?: boolean;
}

export type ImpactLevel = "low" | "medium" | "high";

export interface ChangeImpact {
  changedSymbol: CodeSymbol;
  findings: { id?: string; summary: string; before?: string; after?: string }[];
  directDependents: ImpactReference[];
  indirectDependents: ImpactReference[];
  entryPoints: EntryPointImpact[];
  relatedTests: TestImpact[];
  testGaps: string[];
  maxDepthReached: number;
  confidence: number;
  level: ImpactLevel;
}

export interface ImpactOptions {
  maxDepth: number;
  includeImports: boolean;
  includeInheritance: boolean;
  includeTests: boolean;
  includeEntryPoints: boolean;
}

export const DEFAULT_IMPACT_OPTIONS: ImpactOptions = {
  maxDepth: 3,
  includeImports: true,
  includeInheritance: true,
  includeTests: true,
  includeEntryPoints: true,
};

export interface ImpactSummary {
  behavioralChanges: number;
  highImpactChanges: number;
  affectedSymbols: number;
  affectedEntryPoints: number;
  relatedTests: number;
  potentialTestGaps: number;
}

export interface ImpactDiagnostics {
  symbols: number;
  edges: number;
  unresolvedReferences: number;
  traversalDepth: number;
}

export interface ImpactReport {
  summary: ImpactSummary;
  changes: ChangeImpact[];
  diagnostics: ImpactDiagnostics;
  unresolved?: string;
}

export function idKey(id: SymbolId): string {
  return `${id.file}::${id.qualifiedName}`;
}

export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.9) {
    return "strong";
  }
  if (confidence >= 0.7) {
    return "likely";
  }
  if (confidence >= 0.5) {
    return "possible";
  }
  return "weak";
}
