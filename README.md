# Breakline

**Breakline finds the behavioral changes hiding inside your code diffs.**

Traditional diffs answer *what code changed*. Breakline answers *what behavior changed because of the code change* — and, when it can, proves it with a concrete witness.

v0.1 targets TypeScript and JavaScript through a local CLI. Analysis is deterministic static analysis. No API key, network, or LLM is required.

## Install

```bash
pnpm install
pnpm build
```

The CLI is `@breakline/cli` (`breakline`). After `pnpm build`, run it from the repo (including subdirectories):

```bash
pnpm breakline inspect example.ts
pnpm exec breakline inspect example.ts
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
```

Analyze a git range:

```bash
pnpm breakline analyze main..HEAD
pnpm breakline analyze HEAD~1 HEAD
pnpm breakline analyze --base main --head HEAD
```

Low-confidence findings are hidden unless you pass `--include-low-confidence`.

## Compelling demo

Given `isAdmin && isOwner` becoming `isAdmin || isOwner`, Breakline reports a high-confidence **predicate expanded** finding and a witness such as `isAdmin = true`, `isOwner = false`.

```bash
breakline compare fixtures/conditions/can-delete/before.ts fixtures/conditions/can-delete/after.ts
```

## What v0.1 detects

- Conditional / predicate changes (expanded, restricted, inverted)
- Numeric boundary changes, with boundary witnesses
- Return behavior changes
- Throw added or removed; catch paths that no longer terminate
- Call reachability (newly reachable, no longer reachable, became unconditional)

See [spec/spec.md](spec/spec.md) for the full product definition.

## Develop

```bash
pnpm test
```

Fixture cases live under `fixtures/` as `before.ts`, `after.ts`, and `expected.json`.
