# Breakline

## Semantic Behavioral Change Analysis for Code

**Status:** Initial architecture / v0.1 specification  
**Working name:** Breakline  
**Initial language target:** TypeScript / JavaScript  
**Primary interface:** CLI  
**Future interfaces:** GitHub Actions / CI / PR annotations

---

# 1. Project Overview

Breakline is an open-source semantic code-change analyzer.

Traditional source-control diff tools answer:

> What code changed?

Breakline attempts to answer:

> What behavior changed because of the code change?

Breakline analyzes two versions of source code, identifies changed functions or symbols, builds simplified behavioral representations of those functions, compares those representations, and reports meaningful behavioral differences.

Examples include:

- authorization becoming less restrictive
- validation becoming more restrictive
- boundary conditions changing
- error paths disappearing
- previously unreachable calls becoming reachable
- return behavior changing
- conditions being inverted
- boolean logic changing
- side effects occurring under different conditions

Whenever possible, Breakline should also generate a **witness**: a concrete set of inputs or conditions demonstrating the behavioral difference.

Example:

```diff
- if (admin && active)
+ if (admin || active)
```

Breakline should be capable of producing something conceptually similar to:

```text
Authorization behavior changed

Condition:

  admin && active
       ↓
  admin || active

Witness:

  admin  = true
  active = false

Before:
  branch not taken

After:
  branch taken
```

The goal is not merely to summarize the source-code diff.

The goal is to **derive behavioral differences from program structure**.

---

# 2. Core Principle

Breakline should maintain a strong distinction between:

```text
TEXTUAL CHANGE
```

and:

```text
BEHAVIORAL CHANGE
```

For example:

```diff
- if (age >= 18)
+ if (age > 18)
```

The textual change is:

```text
>= became >
```

The behavioral change is:

```text
age = 18 previously entered the branch.

age = 18 no longer enters the branch.
```

Breakline should report the second.

---

# 3. Product Philosophy

Breakline is:

- a semantic diff tool
- a static-analysis tool
- a behavioral change detector
- a counterexample/witness generator
- a developer-facing explanation system

Breakline is NOT:

- a linter
- a formatter
- a generic AST diff tool
- a vulnerability scanner
- an AI PR-summary bot
- a replacement for unit tests
- a complete symbolic execution engine
- a formal program-equivalence prover

Breakline should prefer **high-confidence, explainable findings** over large quantities of speculative findings.

False positives are particularly harmful for a tool intended for pull-request review.

---

# 4. Initial User Experience

The primary interface for v0.1 is a CLI.

Example:

```bash
breakline analyze main..HEAD
```

Potential alternatives:

```bash
breakline analyze HEAD~1 HEAD
```

or:

```bash
breakline analyze --base main --head HEAD
```

Breakline should:

1. determine the changed files
2. identify changed functions
3. parse the base and head versions
4. construct behavioral representations
5. compare them
6. generate findings
7. generate witnesses when possible
8. print a human-readable report

Example output:

```text
BREAKLINE

Analyzed:
  14 files
  37 changed functions

Findings:
  3 high confidence
  2 medium confidence

────────────────────────────────────────

HIGH
Authorization expanded

src/api/orders.ts:118

Previous behavior:
  Cancellation required ADMIN.

New behavior:
  ADMIN or ORDER_OWNER may cancel.

Witness:
  role = USER
  ownsOrder = true

Before:
  DENIED

After:
  ALLOWED

────────────────────────────────────────

HIGH
Failure path removed

src/payments/charge.ts:87

Previous behavior:
  Payment failure terminated the operation.

New behavior:
  Execution continues after payment failure.

Newly reachable call:
  createShipment()

────────────────────────────────────────

MEDIUM
Boundary changed

src/discounts/apply.ts:41

Previous condition:
  total >= 100

New condition:
  total > 100

Witness:
  total = 100

Before:
  discount applied

After:
  discount not applied
```

---

# 5. v0.1 Scope

The first release should deliberately be narrow.

Supported languages:

- TypeScript
- JavaScript

Initial analysis should operate primarily at the **function level**.

Breakline should initially detect the following classes of behavioral changes.

## 5.1 Conditional Changes

Examples:

```diff
- if (a && b)
+ if (a || b)
```

```diff
- if (enabled)
+ if (!enabled)
```

```diff
- if (a && b)
+ if (a && b && c)
```

```diff
- if (a || b)
+ if (a)
```

Detect whether a branch became:

- more reachable
- less reachable
- differently reachable

---

# 6. Boundary Changes

Examples:

```diff
- age >= 18
+ age > 18
```

```diff
- retries < 3
+ retries <= 3
```

```diff
- amount > 100
+ amount > 500
```

Breakline should attempt to generate boundary witnesses.

Example:

```text
Witness:
  age = 18
```

---

# 7. Return Behavior Changes

Example:

```diff
if (!valid) {
-   return false;
+   return true;
}
```

Breakline should identify that the observable result for the same path changed.

Also detect:

- added returns
- removed returns
- changed returned constants
- changed returned identifiers where reasonably analyzable
- early-return changes

---

# 8. Exception / Error Flow Changes

Example:

```diff
try {
    await charge();
} catch (err) {
-   return failed();
+   logger.error(err);
}
```

Breakline should identify that execution may now continue after `charge()` fails.

Potential finding:

```text
Failure behavior changed

Previously:
  failure in charge() terminated execution.

Now:
  the failure is logged and execution continues.

Newly reachable after failure:
  createShipment()
```

---

# 9. Call Reachability Changes

Breakline should identify when a call becomes reachable under conditions where it previously was not.

Example:

```diff
if (paymentSuccessful) {
    createShipment();
}

+ sendConfirmation();
```

Or:

```diff
- if (authorized) {
-     deleteAccount();
- }

+ deleteAccount();
```

The second example is particularly important.

Potential finding:

```text
Call became unconditional

deleteAccount()

Previously:
  required authorized = true

Now:
  reachable regardless of authorized.
```

---

# 10. Authorization / Validation Changes

Breakline should not initially require domain-specific knowledge of authentication systems.

Instead, authorization findings should emerge from general predicate analysis.

Example:

```diff
- if (!user.isAdmin)
+ if (!user.isAdmin && !user.isOwner)
```

Breakline can infer:

```text
Previously rejected:
  isAdmin = false

Now rejected:
  isAdmin = false AND isOwner = false
```

Therefore:

```text
Newly accepted:
  isAdmin = false
  isOwner = true
```

The CLI may classify this as:

```text
Predicate widened
```

Later versions may introduce higher-level classifications such as:

```text
Authorization expanded
```

Do not make v0.1 dependent upon domain-specific classification.

---

# 11. Architecture

Initial architecture:

```text
Git
 │
 ▼
Diff Discovery
 │
 ▼
Changed File Detection
 │
 ▼
Parser
 │
 ▼
AST
 │
 ▼
Function Extraction
 │
 ▼
Control Flow Analysis
 │
 ▼
Behavioral IR
 │
 ├──────── Base IR
 │
 └──────── Head IR
            │
            ▼
      Semantic Comparator
            │
            ▼
         Findings
            │
            ▼
     Witness Generator
            │
            ▼
        CLI Reporter
```

The architecture should keep these concerns separated.

---

# 12. Suggested Package Structure

Use a monorepo-friendly structure even if Breakline initially contains only one package.

Suggested starting layout:

```text
breakline/
├── package.json
├── tsconfig.json
├── README.md
├── BREAKLINE_SPEC.md
│
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── parser/
│   │   │   ├── ast/
│   │   │   ├── cfg/
│   │   │   ├── ir/
│   │   │   ├── analysis/
│   │   │   ├── compare/
│   │   │   ├── witness/
│   │   │   └── findings/
│   │   └── tests/
│   │
│   └── cli/
│       ├── src/
│       └── tests/
│
├── fixtures/
│   ├── conditions/
│   ├── boundaries/
│   ├── returns/
│   ├── exceptions/
│   └── reachability/
│
└── docs/
    ├── architecture.md
    └── behavioral-ir.md
```

Do not create packages simply to satisfy this diagram if they do not yet provide useful separation.

---

# 13. Behavioral Intermediate Representation

Do NOT compare raw ASTs as the primary semantic abstraction.

Create a simplified Behavioral Intermediate Representation (BIR).

The exact representation should evolve as implementation teaches us what is required.

A possible initial representation:

```ts
interface BehaviorFunction {
  id: string;
  name: string;
  file: string;

  parameters: BehaviorParameter[];

  paths: BehaviorPath[];
}
```

Example path:

```ts
interface BehaviorPath {
  conditions: BehaviorExpression[];

  effects: BehaviorEffect[];
}
```

Potential effects:

```ts
type BehaviorEffect =
  | ReturnEffect
  | ThrowEffect
  | CallEffect;
```

Potential condition representation:

```ts
type BehaviorExpression =
  | BooleanExpression
  | ComparisonExpression
  | LogicalExpression
  | NegationExpression;
```

Example:

```ts
interface ComparisonExpression {
  kind: "comparison";

  operator:
    | "=="
    | "==="
    | "!="
    | "!=="
    | ">"
    | ">="
    | "<"
    | "<=";

  left: BehaviorValue;
  right: BehaviorValue;
}
```

Logical expression:

```ts
interface LogicalExpression {
  kind: "logical";

  operator: "and" | "or";

  left: BehaviorExpression;
  right: BehaviorExpression;
}
```

Negation:

```ts
interface NegationExpression {
  kind: "not";

  expression: BehaviorExpression;
}
```

This representation should be normalized enough that syntactically different but behaviorally equivalent expressions can eventually compare cleanly.

Example:

```ts
if (!(x < 10))
```

and:

```ts
if (x >= 10)
```

should eventually be recognized as equivalent.

That does not need to work in the first implementation.

---

# 14. Control-Flow Representation

For simple functions, construct enough of a control-flow graph to understand:

- conditions
- branches
- returns
- throws
- calls
- reachability

Example:

```ts
function authorize(user) {
    if (!user.isAdmin) {
        return false;
    }

    performOperation();

    return true;
}
```

Conceptually:

```text
ENTRY
  │
  ▼
!user.isAdmin
 ├── TRUE ──► return false
 │
 └── FALSE ─► performOperation()
                    │
                    ▼
                return true
```

The Behavioral IR does not necessarily need to expose the CFG directly.

The CFG is an analysis mechanism.

The BIR is the semantic representation used for comparison.

---

# 15. Semantic Comparison

The comparator is the heart of Breakline.

Given:

```text
BaseBehavior
```

and:

```text
HeadBehavior
```

it should produce:

```ts
BehaviorFinding[]
```

Possible initial finding types:

```ts
type FindingType =
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
```

Example finding:

```ts
interface BehaviorFinding {
  type: FindingType;

  confidence: "high" | "medium" | "low";

  file: string;

  symbol: string;

  location?: SourceLocation;

  summary: string;

  before?: BehaviorDescription;

  after?: BehaviorDescription;

  witness?: BehaviorWitness;

  evidence: FindingEvidence[];
}
```

Findings should retain machine-readable evidence.

Do not make the human-readable description the canonical representation.

---

# 16. Witness Generation

Witness generation is one of Breakline's most important differentiators.

Given two predicates:

```text
P_before(x)
P_after(x)
```

Breakline wants to find:

```text
x
```

such that:

```text
P_before(x) != P_after(x)
```

For simple boolean expressions, this can initially be implemented through exhaustive enumeration.

Example:

```text
Before:
  admin && active

After:
  admin || active
```

Possible inputs:

```text
admin active

false false
false true
true  false
true  true
```

Breakline discovers:

```text
false true
true  false
```

as witnesses.

One witness is sufficient for the basic finding.

For simple numeric comparisons, use boundary candidate generation.

Example:

```text
x >= 18
x > 18
```

Generate candidates around constants:

```text
17
18
19
```

and compare results.

This avoids introducing a solver immediately.

---

# 17. Future Solver Integration

Do NOT make an SMT solver a requirement for the first working prototype.

However, design the witness system so a solver can later be introduced.

Possible future architecture:

```ts
interface WitnessSolver {
  findDifference(
    before: BehaviorExpression,
    after: BehaviorExpression
  ): Promise<BehaviorWitness | null>;
}
```

Initial implementations might include:

```text
BooleanEnumerator
NumericBoundarySolver
```

Future:

```text
Z3WitnessSolver
```

Eventually Breakline could translate predicates into solver constraints and ask for:

```text
before != after
```

This could produce concrete counterexamples for considerably more complicated expressions.

---

# 18. Confidence

Every finding should carry a confidence level.

Example:

```text
HIGH
```

Breakline can prove the behavior differs for a concrete witness.

Example:

```text
MEDIUM
```

Static analysis strongly suggests a reachability change but incomplete information prevents a concrete witness.

Example:

```text
LOW
```

Behavior may have changed but depends heavily on unknown runtime behavior.

Initially, avoid displaying LOW findings by default.

Potential CLI option later:

```bash
breakline analyze --include-low-confidence
```

---

# 19. Evidence

Every finding should be explainable.

Store evidence such as:

```ts
interface FindingEvidence {
  kind:
    | "predicate"
    | "return"
    | "throw"
    | "call"
    | "control-flow";

  before?: unknown;
  after?: unknown;

  source?: SourceLocation;
}
```

A user should eventually be able to ask:

> Why did Breakline report this?

and Breakline should be capable of showing the analysis that produced the finding.

Avoid opaque AI-generated findings.

---

# 20. AI / LLM Usage

LLMs must NOT be required for core correctness.

The analysis pipeline should produce structured findings deterministically.

Correct:

```text
AST
 ↓
CFG
 ↓
Behavioral IR
 ↓
Comparator
 ↓
Structured Finding
 ↓
optional LLM explanation
```

Incorrect:

```text
git diff
 ↓
LLM
 ↓
"Something might have changed."
```

LLMs may eventually help with:

- improving explanations
- classifying findings
- summarizing multiple findings
- understanding domain terminology
- ranking findings

But Breakline should remain useful without an API key or network connection.

---

# 21. Git Integration

Breakline should eventually support:

```bash
breakline analyze main..HEAD
```

Internally:

```text
git diff --name-only
```

can identify candidate files.

Breakline then needs access to both versions of each file.

Conceptually:

```text
BASE FILE
    │
    ▼
parse
    │
    ▼
Base AST

HEAD FILE
    │
    ▼
parse
    │
    ▼
Head AST
```

Do not rely exclusively on textual diff hunks.

Diffs identify where Breakline should look.

The semantic analysis should operate on complete functions or symbols.

---

# 22. Function Matching

Functions must be matched between base and head.

Initially use simple strategies:

1. exported symbol name
2. function name
3. class + method name
4. source proximity when necessary

Do not attempt sophisticated rename detection initially.

Represent identity explicitly:

```ts
interface SymbolIdentity {
  file: string;
  container?: string;
  name: string;
  kind:
    | "function"
    | "method"
    | "arrow-function";
}
```

---

# 23. Parser Choice

Do not write a TypeScript parser.

Use an existing TypeScript-capable parser.

Reasonable candidates include:

- TypeScript Compiler API
- ts-morph
- Tree-sitter
- Babel parser

For the initial TypeScript-focused implementation, prefer tooling that provides:

- reliable TypeScript ASTs
- source locations
- traversal
- straightforward node inspection

Keep Breakline's internal Behavioral IR independent of the parser so other language frontends can eventually be introduced.

Desired future architecture:

```text
TypeScript frontend ─┐
Python frontend ─────┤
Java frontend ───────┼──► Behavioral IR
C# frontend ─────────┤
Go frontend ─────────┘
```

---

# 24. Testing Strategy

Tests are critical.

Behavioral analysis should be fixture-driven.

Example fixture:

```text
fixtures/
  conditions/
    and-to-or/
      before.ts
      after.ts
      expected.json
```

`before.ts`:

```ts
export function allowed(admin: boolean, active: boolean) {
    if (admin && active) {
        return true;
    }

    return false;
}
```

`after.ts`:

```ts
export function allowed(admin: boolean, active: boolean) {
    if (admin || active) {
        return true;
    }

    return false;
}
```

`expected.json`:

```json
{
  "findings": [
    {
      "type": "predicate-expanded",
      "confidence": "high"
    }
  ]
}
```

The test should additionally verify that Breakline can generate a witness such as:

```json
{
  "admin": true,
  "active": false
}
```

and verify:

```text
before(witness) != after(witness)
```

---

# 25. Initial Fixture Matrix

Create fixtures covering at least:

```text
AND → OR

OR → AND

condition → !condition

>= → >

> → >=

< → <=

threshold 100 → 500

return true → false

return removed

throw added

throw removed

conditional call → unconditional call

unconditional call → conditional call

early return added

early return removed
```

Also include **negative fixtures** where textual changes do NOT alter behavior.

Examples:

```ts
x > 10
```

versus:

```ts
10 < x
```

Eventually:

```ts
!(x < 10)
```

versus:

```ts
x >= 10
```

Negative tests are extremely important because Breakline must avoid reporting semantic changes where none exist.

---

# 26. Development Milestones

## Milestone 1 — Parse Functions

Goal:

Given a TypeScript file, identify:

- functions
- methods
- parameters
- source locations

Acceptance criteria:

```bash
breakline inspect example.ts
```

can enumerate functions.

---

## Milestone 2 — Normalize Expressions

Support:

- identifiers
- literals
- property access
- `!`
- `&&`
- `||`
- `==`
- `===`
- `!=`
- `!==`
- `<`
- `<=`
- `>`
- `>=`

Acceptance criteria:

```ts
if (admin && active)
```

becomes a stable BehavioralExpression.

---

## Milestone 3 — Compare Predicates

Given:

```text
before.ts
after.ts
```

detect:

```text
admin && active
```

changing to:

```text
admin || active
```

Acceptance criteria:

Breakline emits:

```text
predicate-expanded
```

---

## Milestone 4 — Boolean Witness Generation

Enumerate boolean input combinations.

Acceptance criteria:

Breakline generates:

```text
admin=true
active=false
```

and proves the branch result differs.

---

## Milestone 5 — Numeric Boundary Witnesses

Support simple comparisons against constants.

Example:

```text
age >= 18
```

versus:

```text
age > 18
```

Acceptance criteria:

Breakline generates:

```text
age=18
```

---

## Milestone 6 — Return Analysis

Detect changed return behavior.

Acceptance criteria:

```diff
- return false
+ return true
```

produces a structured finding.

---

## Milestone 7 — Simple CFG

Represent:

- branches
- returns
- throws
- calls

Acceptance criteria:

Breakline can determine whether a call is conditionally or unconditionally reachable.

---

## Milestone 8 — Reachability Findings

Detect:

```text
call newly reachable
call no longer reachable
call became unconditional
```

---

## Milestone 9 — Git Comparison

Implement:

```bash
breakline analyze main..HEAD
```

Acceptance criteria:

Breakline automatically finds changed TypeScript files and analyzes relevant functions.

---

## Milestone 10 — CLI Report

Produce useful developer-facing output.

At this point Breakline should constitute a usable experimental release.

Target:

```text
v0.1.0
```

---

# 27. Non-Goals for v0.1

Do NOT attempt:

- whole-program symbolic execution
- complete interprocedural analysis
- database semantic analysis
- distributed-system analysis
- concurrency analysis
- runtime reflection analysis
- dynamic JavaScript analysis
- automatic security vulnerability detection
- Python support
- Java support
- C# support
- IDE extensions
- GitHub bot
- SaaS backend
- web dashboard
- LLM integration
- sophisticated state-machine inference

Those may become future projects or Breakline capabilities.

The first version must remain focused.

---

# 28. Engineering Principles

## Keep the core deterministic

Given the same source code, Breakline should produce the same findings.

## Preserve evidence

Every finding should trace back to AST/CFG/IR evidence.

## Prefer proof over speculation

A finding with a concrete witness is substantially more valuable than a heuristic warning.

## Favor precision

It is better to report three meaningful behavioral changes than thirty questionable ones.

## Separate frontends from analysis

Language-specific parsing should terminate at the Behavioral IR boundary.

## Keep analysis composable

Individual analyzers should ideally operate independently.

Example:

```ts
interface BehaviorAnalyzer {
  analyze(
    before: BehaviorFunction,
    after: BehaviorFunction
  ): BehaviorFinding[];
}
```

Potential implementations:

```text
PredicateAnalyzer
BoundaryAnalyzer
ReturnAnalyzer
ExceptionAnalyzer
ReachabilityAnalyzer
```

---

# 29. Definition of the First Compelling Demo

The first demo should compare these two files.

Before:

```ts
export function canDelete(
    isAdmin: boolean,
    isOwner: boolean
): boolean {
    if (isAdmin && isOwner) {
        return true;
    }

    return false;
}
```

After:

```ts
export function canDelete(
    isAdmin: boolean,
    isOwner: boolean
): boolean {
    if (isAdmin || isOwner) {
        return true;
    }

    return false;
}
```

Running:

```bash
breakline compare before.ts after.ts
```

should produce approximately:

```text
BREAKLINE

1 behavioral change found

HIGH
Predicate expanded

Function:
  canDelete

Previous condition:
  isAdmin && isOwner

New condition:
  isAdmin || isOwner

Witness:
  isAdmin = true
  isOwner = false

Previous result:
  false

New result:
  true
```

If Breakline can produce this result through deterministic program analysis—not by sending the diff to an LLM—the fundamental concept has been demonstrated.

---

# 30. North Star

The project should continually optimize toward answering:

> What can this program do now that it could not do before, or what can it no longer do?

The longer-term conceptual pipeline is:

```text
CODE CHANGE
     │
     ▼
BEHAVIORAL DIFFERENCE
     │
     ├── concrete witness
     ├── affected path
     ├── affected callers
     ├── affected tests
     └── risk assessment
```

The initial product promise is simpler:

> **Breakline finds the behavioral changes hiding inside your code diffs.**

---

# 31. Instructions for AI Coding Agents

When working on Breakline:

1. Read this specification before making architectural decisions.
2. Keep changes aligned with the current milestone.
3. Do not implement future features merely because they appear elsewhere in this document.
4. Prefer small, testable components.
5. Add tests for every behavioral-analysis capability.
6. Add negative tests alongside positive detection tests.
7. Do not introduce LLM dependencies into the analysis pipeline.
8. Do not introduce an SMT solver until simple witness generation has demonstrated its limitations.
9. Preserve source locations and analysis evidence wherever practical.
10. Keep parser-specific AST types out of the core Behavioral IR.
11. Prefer deterministic analysis over heuristic interpretation.
12. Avoid premature abstractions for languages other than TypeScript, while maintaining clean boundaries that make additional frontends possible.
13. Do not silently broaden v0.1 scope.
14. When uncertain whether a feature belongs in the current implementation, choose the smaller implementation.
15. Treat a low false-positive rate as a primary product requirement.

---

# 32. Recommended First Task

Do not begin by implementing the entire architecture.

Start with a vertical slice.

Implement:

```text
TypeScript source
      ↓
parse
      ↓
find named function
      ↓
extract if-condition
      ↓
normalize condition into BehavioralExpression
      ↓
compare two expressions
      ↓
enumerate boolean witnesses
      ↓
produce Finding
```

Support this exact scenario first:

```text
admin && active
        ↓
admin || active
```

Once the end-to-end vertical slice works and is well tested, generalize each stage incrementally.

The first engineering objective is therefore:

> Given two TypeScript versions of the same function containing a boolean conditional, determine whether the condition's truth set changed and, if so, produce a concrete input demonstrating the difference.

That is the smallest implementation that proves Breakline's core idea.