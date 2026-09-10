# Behavioral Intermediate Representation

The Behavioral IR (BIR) is the semantic representation Breakline compares. The CFG walk is an analysis mechanism; it is not what the reporter prints.

## Function

A `BehaviorFunction` is a named symbol with parameters, source location, original `if` predicates (`branchPredicates`), and a set of `BehaviorPath` values.

## Path

A path is:

- `conditions` — predicates that must hold to reach this path (`and` of the list)
- `effects` — `return`, `throw`, or `call` in source order

An empty condition list means the path is unconditional.

## Expressions

Supported v0.1 expressions:

- identifiers, literals, property access (`user.isAdmin`)
- `!`, `&&`, `||`
- `== === != !== < <= > >=`
- synthetic `throws` atoms for catch paths (`charge() throws`)

Comparisons with a literal on the left are flipped (`10 < x` → `x > 10`). Simple negated comparisons are rewritten (`!(x < 10)` → `x >= 10`).

## Effects

- `return` with an optional value
- `throw` with an optional value
- `call` with a callee name; `onCatch` marks the modeled failure edge out of a `try`

## Findings

A finding is structured data: `type`, `confidence`, `symbol`, optional `before` / `after` descriptions, optional `witness`, and machine-readable `evidence`. The CLI string is a view of that data, not the source of truth.

Confidence:

- **high** — a concrete witness (or an explicit structural proof such as a throw appearing)
- **medium** — strong static signal without a witness
- **low** — collected, hidden by default
