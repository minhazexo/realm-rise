# TypeScript + Bun Workflow

Both runtimes work. Single lockfile (`package-lock.json`) — Bun reads the
npm-installed `node_modules` directly, no `bun.lock` needed.

| Command         | npm              | bun              |
|-----------------|------------------|------------------|
| dev             | `npm run dev`    | `bun run dev`    |
| build           | `npm run build`  | `bun run build`  |
| test            | `npm test`       | `bun run test`   |
| typecheck       | `npm run typecheck` | `bun run typecheck` |
| install         | `npm install`    | `bun install`    |

`tsconfig.json` is strict (`strict`, `noUncheckedIndexedAccess`,
`verbatimModuleSyntax`, `moduleResolution: bundler`). It covers `src/**`.
JS files are not checked (`checkJs` off) — migration is file-by-file.

## Two hard rules for new `.ts` modules

1. **Import with the `.ts` extension**: `import { x } from './math.ts'`.
   Node (type-stripping) and Bun resolve `.ts` specifiers natively;
   extensionless/`.js` specifiers pointing at `.ts` files break under
   plain Node. Pilot: `src/utils/math.ts` (+ 6 importers updated).
2. **Erasable syntax only** — no `enum`, `namespace`, or parameter
   properties. Types, interfaces, generics, `as`, and `private`
   are fine. This keeps files runnable under Node strip-types, Bun,
   and Vite/esbuild with zero config.

## Migration order (one module per PR, keep `npm test` green)

`utils` → `core` (Registry, EventBus) → `data/*` (defs + registries) →
`systems/*` → `entities` → `world` → `scenes` → `app` components.
Convert leaf-first; each PR: rename, add types, update importers to
`.ts` specifiers, run `typecheck` + `test` + `build`.
