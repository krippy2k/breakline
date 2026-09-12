# Publish Breakline to npm

The repo is a pnpm workspace. The root package stays private. These packages are public:

| Package | What users get |
| --- | --- |
| [`@breakline/cli`](https://www.npmjs.com/package/@breakline/cli) | `breakline` binary (`inspect`, `compare`, `analyze`) |
| [`@breakline/core`](https://www.npmjs.com/package/@breakline/core) | Analysis engine |
| [`@breakline/report`](https://www.npmjs.com/package/@breakline/report) | Structured reports and `analyze()` |
| [`@breakline/github`](https://www.npmjs.com/package/@breakline/github) | GitHub App adapter |

`@breakline/server` stays private. Run the GitHub App from this repository.

The unscoped name `breakline` is already taken on npm. The CLI package is `@breakline/cli`; the installed command is still `breakline`.

---

## 1. Create the npm scope

1. Create an [npm account](https://www.npmjs.com/signup) if you do not have one.
2. Create the [`@breakline` organization](https://www.npmjs.com/org/create), or use an organization you already own and rename the packages.
3. Add yourself as an owner who can publish public packages.

```bash
npm login
npm org ls breakline
```

---

## 2. Confirm the local build

```bash
pnpm install
pnpm build
pnpm test
```

---

## 3. Dry-run a pack

From any publishable package:

```bash
pnpm --filter @breakline/cli exec npm pack --dry-run
```

Check that the tarball contains `dist/` and the `breakline` bin, and does not contain `src/`, tests, or fixtures.

---

## 4. Publish

`workspace:^` dependencies are rewritten to real versions (`^0.4.0`) on publish. Publish in dependency order, or use the workspace script:

```bash
pnpm publish:packages
```

That runs `pnpm -r --filter "./packages/**" publish --access public`.

To publish one package:

```bash
pnpm --filter @breakline/core publish --access public
pnpm --filter @breakline/cli publish --access public
```

`prepublishOnly` compiles TypeScript before the tarball is written.

The first publish of a scoped package requires `--access public` (already set in `publishConfig`).

---

## 5. Install what you published

```bash
npm install -g @breakline/cli
breakline --version
breakline analyze HEAD~1 HEAD
```

or:

```bash
npx @breakline/cli analyze HEAD~1 HEAD
```

Programmatic use:

```bash
npm install @breakline/core
```

```ts
import { compareSources } from "@breakline/core";
```

---

## Versioning

Package versions live in each `packages/*/package.json`. Keep them aligned when you release.

After a release, bump the versions in those files (and the CLI `--version` string in `packages/cli/src/index.ts`) before the next publish.

---

## What is not published

- The workspace root (`breakline`, `private: true`)
- `@breakline/server`
- `fixtures/`, `spec/`, and `apps/`
