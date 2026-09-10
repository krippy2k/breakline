# Architecture

Breakline keeps parsing, analysis, comparison, and reporting in separate layers.

```text
Git or two files
        │
        ▼
Changed file detection
        │
        ▼
TypeScript Compiler API
        │
        ▼
Function extraction
        │
        ▼
Control-flow walk → Behavioral IR
        │
        ▼
Analyzers (predicate, boundary, return, exception, reachability)
        │
        ▼
Witness solvers (boolean enumeration, numeric boundaries)
        │
        ▼
Structured findings → CLI reporter
```

## Packages

- `@breakline/core` — parser, BIR, analyzers, witnesses, findings
- `@breakline/cli` — `inspect`, `compare`, `analyze`, and the human-readable report

Language-specific AST types stop at the BIR boundary. Comparators only see `BehaviorFunction` values.

## Analyzers

Each analyzer implements the same idea: compare two `BehaviorFunction` values and emit `BehaviorFinding[]`.

| Analyzer | Finding types |
| --- | --- |
| PredicateAnalyzer | predicate-expanded, predicate-restricted, predicate-changed |
| BoundaryAnalyzer | boundary-changed |
| ReturnAnalyzer | return-changed, return-added, return-removed |
| ExceptionAnalyzer | throw-added, throw-removed, failure-path reachability |
| ReachabilityAnalyzer | call-newly-reachable, call-no-longer-reachable, call-became-unconditional |

## Git

`analyze` uses git only to list candidate files and load both full file versions. Semantic analysis always runs on complete functions, not hunks.

## Non-goals in this layer

No LLM in the pipeline. No SMT solver. Witness generation is exhaustive enumeration and boundary candidates, behind a `WitnessSolver` interface so a solver can be added later.
