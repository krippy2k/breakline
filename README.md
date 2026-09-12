# Breakline

**Breakline finds the behavioral changes hiding inside your code diffs.**

Traditional diffs answer *what code changed*. Breakline answers *what behavior changed because of the code change* — and, when it can, proves it with a concrete witness.

v0.4 adds a GitHub App that analyzes pull requests and publishes Breakline reports as GitHub Checks. The local CLI still targets TypeScript and JavaScript. Analysis is deterministic static analysis. No API key, network, or LLM is required for CLI use.

## Install

```bash
npm install -g @breakline/cli
breakline analyze main..HEAD
```

Without a global install:

```bash
npx @breakline/cli analyze main..HEAD
```

The published command is `breakline`. The npm package is `@breakline/cli` because the unscoped name is already taken. See [docs/npm.md](docs/npm.md) to publish the workspace packages.

### From this repository

```bash
pnpm install
pnpm build
pnpm breakline inspect example.ts
```

File arguments are resolved from the directory you invoked the command in.

## Commands

Inspect functions in a file:

```bash
pnpm breakline inspect example.ts
```

Compare two versions of the same function(s):

```bash
pnpm breakline compare before.ts after.ts
pnpm breakline compare before.ts after.ts --impact
pnpm breakline compare before.ts after.ts --format json
pnpm breakline compare before.ts after.ts --output findings.json
```

Analyze a git range:

```bash
pnpm breakline analyze main..HEAD
pnpm breakline analyze HEAD~1 HEAD
pnpm breakline analyze --base main --head HEAD
pnpm breakline analyze main..HEAD --format json --output findings.json
pnpm breakline analyze main..HEAD --no-impact
pnpm breakline analyze main..HEAD --impact-depth 4 --show-impact-paths --verbose
```

`--format` is `text` (default) or `json`. JSON uses schema version `0.3`. `analyze` includes impact analysis by default.

Low-confidence v0.1 findings are hidden unless you pass `--include-low-confidence`.

## v0.3 impact example

A pricing change is not just a local return tweak. If `calculatePrice()` is used by checkout, Breakline reports the blast radius:

```bash
# from fixtures/impact/demo, after a git commit that changes src/pricing.ts
breakline analyze HEAD~1 HEAD --show-impact-paths
```

```text
HIGH IMPACT
────────────────────────────────────────

calculatePrice()

Direct dependents:
  createOrder()

Indirect dependents:
  checkout()

Entry points:
  POST /checkout

Related tests:
  ✓ calculates price

Confidence:
  0.95 (strong)
```

See `fixtures/impact/demo/` for the sample checkout graph.

## v0.2 example

Given this change to `processOrder`:

```ts
// before
export function processOrder(status: string) {
  if (status === "pending") {
    save(status);
    return true;
  }
  return false;
}

// after
export function processOrder(status: string) {
  if (status !== "shipped") {
    save(status);
    auditOrder(status);
    return false;
  }
  return false;
}
```

```bash
breakline compare fixtures/v0.2/mixed/multiple-findings/before.ts fixtures/v0.2/mixed/multiple-findings/after.ts
```

Breakline reports the condition change, the new `auditOrder` call, and the changed return — without claiming the condition was widened or narrowed.

```text
BREAKLINE  .../after.ts

processOrder()
  BEHAVIOR CHANGED

  • Condition changed
      before: status === "pending"
      after:  status !== "shipped"

  • Return behavior changed
      before: true
      after:  false

  • New call
      after:  auditOrder(status)
```

Machine-readable output is the same Finding model:

```bash
breakline compare before.ts after.ts --format json
```

```json
{
  "schemaVersion": "0.2",
  "files": [
    {
      "path": "after.ts",
      "findings": []
    }
  ]
}
```

## Compelling demo (v0.1 witnesses)

Given `isAdmin && isOwner` becoming `isAdmin || isOwner`, Breakline still proves a **predicate expanded** difference with a witness such as `isAdmin = true`, `isOwner = false`.

```bash
breakline compare fixtures/conditions/can-delete/before.ts fixtures/conditions/can-delete/after.ts
```

## What v0.3 detects

- Direct and indirect dependents of a changed symbol
- HTTP route / event / CLI entry points that can reach it
- Related tests and potential test gaps
- Heuristic impact level and confidence

## What v0.2 detects

- Function added or removed
- Signature changes (parameters, defaults, optional/required, explicit return type, async)
- Conditional changes in `if`, loops, and ternaries
- Return expression and return-path changes
- Calls added, removed, or with different arguments
- Throw added or removed

v0.1 still detects predicate expansion/restriction, numeric boundaries, and call reachability, and attaches a witness when one can be proven.

See [spec/spec.md](spec/spec.md), [spec/v0.2.md](spec/v0.2.md), [spec/v0.3.md](spec/v0.3.md), and [spec/v0.4.md](spec/v0.4.md) for the full product definition.

## GitHub App (v0.4)

Install the Breakline GitHub App on a repository. Opening or updating a pull request creates a `Breakline` check with behavioral impact, key findings, and a link to the hosted report.

```bash
pnpm dev:github
```

See [docs/github-app-install.md](docs/github-app-install.md) for the step-by-step install and configuration guide.

## Develop

```bash
pnpm install
pnpm build
pnpm test
```

Fixture cases live under `fixtures/` as `before.ts`, `after.ts`, and `expected.json`. v0.2 classifier fixtures are under `fixtures/v0.2/`. Impact fixtures are under `fixtures/impact/`.
