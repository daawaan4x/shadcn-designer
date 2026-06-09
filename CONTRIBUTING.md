## Codebase Architecture

This repository (`shadcn-designer`) is a **Turborepo monorepo** that serves as
a design-system storybook for previewing [shadcn/ui] component blocks inside a
live Next.js viewer. It pairs a component library, a block viewer app, and a
design reference folder into one cohesive workflow.

### Monorepo layout

```
mmsu-appui/
├── apps/
│   └── web/                    # Next.js app — the block viewer
├── packages/
│   ├── ui/                     # Shared UI component library (shadcn/ui)
│   ├── eslint-config/          # Shared ESLint configuration
│   └── typescript-config/      # Shared TypeScript configuration
├── design/                     # Design reference files (see design/README.md)
├── turbo.json                  # Turborepo task pipeline
├── pnpm-workspace.yaml         # pnpm workspace definition
├── AGENTS.md                   # AI agent instructions
└── CONTRIBUTING.md             # This file
```

### Workspaces

#### `apps/web` — Block viewer

The main Next.js application. Its sole purpose is to present a browsable,
interactive viewer for full-page UI compositions ("blocks"). The viewer has
three panes:

- **Sidebar** — lists all discovered blocks for navigation.
- **Toolbar** — theme toggle (light / dark / system) and responsive screen-size
  presets (desktop / tablet / phone).
- **Preview** — renders the selected block in an iframe with draggable resize
  handles.

The root `page.tsx` is a **Server Component** that uses `fs.readdirSync` to
discover block directories under `app/blocks/` at build time. New blocks are
picked up automatically—no manual registry.

#### `packages/ui` — Component library

All shadcn/ui primitives live here, installed via:

```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

Components are exported through the `@workspace/ui` package alias:

```tsx
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
```

The package uses `class-variance-authority` for variant styling, `@base-ui/react`
for headless primitives (Toggle, ToggleGroup, etc.), and `tailwind-merge` for
class deduplication.

#### `design/` — Design reference

Not a workspace—just a folder of design handoff materials (prototype HTML,
brand specs, token definitions, font assets). See [design/README.md] for full
documentation. The `.gitignore` inside blocks everything except itself and the
README; contributors must explicitly unignore files they want to track.

### Block system

Each block is a self-contained Next.js route under `apps/web/app/blocks/`:

```
app/blocks/
├── dashboard-01/
│   ├── page.tsx            # Full-page composition
│   ├── components/         # Block-specific components
│   └── data.json           # Mock data (optional)
├── login-01/
│   └── page.tsx
├── sidebar-01/
│   └── page.tsx
└── ...
```

Blocks are **full-page compositions**, not isolated atoms. Each `page.tsx` is a
standalone Next.js route that typically contains its own layout structure (e.g.,
its own `SidebarProvider`, header, content area).

### Why iframes

The viewer renders blocks in an **iframe** rather than importing them as
sub-components. This is intentional:

1. **Layout isolation** — blocks often declare their own full-screen layout
   wrappers (e.g., nested `SidebarProvider`). Rendering them directly inside the
   viewer's layout would cause CSS collisions and nested layout bugs.
2. **True preview** — the iframe shows each block exactly as it appears when
   visited directly at its route, making it a faithful preview.
3. **Server Component compatibility** — blocks may use Server Components, which
   cannot be rendered inside the viewer's Client Component tree.

### Design-to-code workflow

1. Place design reference files (prototypes, specs, assets) in `design/`.
2. Read `design/DESIGN.md` and `design/brand-spec.md` for design tokens and
   visual rules.
3. Create a new block under `apps/web/app/blocks/<block-name>/` with a
   `page.tsx` that composes primitives from `packages/ui/`.
4. Run `pnpm dev` and use the viewer to compare the rendered block against the
   prototype HTML.
5. Iterate until the block matches the design intent.

### Key conventions

- **Component imports** use the `@workspace/ui/components/<name>` alias, never
  relative paths into `packages/ui/`.
- **Blocks** are named with a pattern like `<category>-<number>` (e.g.,
  `login-01`, `sidebar-05`, `dashboard-01`).
- **Theme** is managed via `next-themes` with a `ThemeProvider` wrapper in the
  root layout. Press `d` to toggle dark mode.
- **shadcn style** is `base-nova` with `neutral` base color and CSS variables
  enabled (see `components.json` in both `apps/web` and `packages/ui`).

[shadcn/ui]: https://ui.shadcn.com
[design/README.md]: ./design/README.md

---

## Documentation

Treat documentation as part of the behavior being changed. Update it in the same
change as the code, and remove guidance that is no longer true.

Write for the reader who needs to make a correct decision or complete a task.
State the important information first, use short sections and concrete examples,
and prefer the smallest durable explanation that prevents a likely mistake.

### Choose the right location

Put information where readers will look for it and where maintainers can keep it
accurate:

- `CONTRIBUTING.md` explains repository-wide contributor practices.
- `AGENTS.md` gives coding agents durable, operational repository instructions.
- JSDoc/TSDoc describes a callable API's contract near its declaration.
- Inline comments explain local rationale, constraints, and surprising behavior.
- External documentation should cover concepts or workflows that span multiple
  files and cannot be understood well from the code alone.

Do not duplicate the same rule in several places. Keep one authoritative
explanation and link to it when another document needs the context.

### Agent instructions (`AGENTS.md`)

Write `AGENTS.md` as a concise operating guide for Codex and other coding agents
that support it. It should contain repository facts and repeatable instructions,
not general advice that an agent can infer from the code.

A useful root `AGENTS.md` usually includes:

- A short repository map naming the important apps, packages, and ownership
  boundaries.
- Exact setup, development, build, lint, typecheck, test, and formatting
  commands. Commands must be runnable from the directory the document describes.
- Project-specific architecture and coding conventions, especially choices that
  are not obvious from nearby code.
- Safety constraints, generated-file rules, and actions that require approval.
- A definition of done with the checks required for different kinds of changes.
- Pull request or review expectations that materially affect implementation.

Write instructions as direct, testable actions:

```md
## Verification

- Run `pnpm lint` and `pnpm typecheck` after changing TypeScript.
- Run `pnpm build` when changing package exports or build configuration.
- Do not edit files under `src/prisma/generated`; run `pnpm prisma:generate`.
```

#### Examples in agent instructions

Examples help when they demonstrate a repository-specific decision, command, or
completion condition. Keep them short enough to scan and narrow enough that the
surrounding rule remains authoritative.

A useful example shows:

- The situation that activates the instruction.
- The expected action or file path.
- The command or observable result that verifies completion.

For example:

```md
## Shared contract changes

When adding a `Task` resource:

1. Add row and operation schemas under `packages/shared/src/models`.
2. Add separate procedure input and output schemas under
   `packages/shared/src/api`.
3. Assemble the resource routes after those schemas, then register the routes in
   `packages/shared/src/api/index.ts`.
4. Implement persistence under `apps/server/src/modules`.
5. Run `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
```

Avoid examples that merely restate vague preferences:

```md
- Write good code.
- Follow the architecture.
- Add tests when appropriate.
```

Do not copy large source files into agent instructions. Link to the
authoritative architecture section or a small representative file, and update
the example when the referenced pattern changes.

Keep the root file short and broadly applicable. Put specialized instructions in
a nested `AGENTS.md` near the code they govern; instructions closer to the
working directory take precedence. Use `AGENTS.override.md` only for an
intentional replacement at that directory level.

Avoid:

- Vague rules such as "write clean code" or "follow best practices."
- Temporary task details, secrets, credentials, or machine-specific paths.
- Commands that have not been verified.
- Repeating package metadata, source code, or long architecture documents.
- Conflicting instructions without stating which scope takes precedence.

Review `AGENTS.md` after repeated agent mistakes or workflow changes. Verify that
Codex loads the intended instruction chain with:

```sh
codex --ask-for-approval never "Summarize the current instructions."
```

An empty `AGENTS.md` is ignored, so add only guidance that is accurate and useful.

### Code documentation

Code comments should preserve knowledge that is not clear from names, types, and
control flow. Explain the contract or the reason, not a line-by-line translation
of the implementation.

Document:

- Ownership and boundaries when a module coordinates several responsibilities.
- Consumer-visible behavior, defaults, side effects, error behavior, and runtime
  assumptions.
- Invariants and constraints that future changes must preserve.
- Workarounds and intentional deviations from the normal project pattern.
- Security, transaction, concurrency, caching, and performance decisions.
- Generated-code boundaries and the command used to regenerate files.

Do not add comments merely to increase documentation coverage. Rename or
simplify code when that communicates the intent more clearly.

#### Module comments

Add a module-level comment only when it provides orientation that the filename
and exports do not. A useful module comment states what the module owns, why the
boundary exists, and any important integration contract.

Keep module comments short. Editors and symbol navigation surface declaration
JSDoc more reliably than file headers, so put examples and detailed usage notes
on the exported type, value, or function they explain.

Write module comments as noun-oriented ownership summaries, not function
summaries. A module is usually a boundary, contract, configuration surface, or
integration point, so its first sentence should name that concept. Reserve
behavior-focused verbs such as "Creates...", "Validates...", or "Renders..." for
functions, methods, components, and other callable declarations.

Useful patterns include:

- Name the module's responsibility when it configures or connects several
  systems, such as an application database client boundary that translates a
  connection URL, attaches extensions, and controls instance reuse.
- Record conventions that other layers depend on, such as how model names and
  infrastructure errors map to public API error codes.
- Explain non-obvious lifecycle decisions, such as storing a singleton on
  `globalThis` to survive development hot reloads.
- Describe deliberate exposure boundaries, such as copying only a curated,
  browser-safe subset of generated files into a shared package.
- State where generated input comes from, where derived output goes, and which
  command owns regeneration.

For example:

```ts
/**
 * Application database client boundary.
 *
 * Translates the connection URL, attaches application query extensions, and
 * reuses one client during development to avoid opening a new connection pool
 * after every hot reload.
 */
```

Do not require a header for every non-trivial file. Omit it when it would only
repeat the filename, imports, exports, or implementation steps.

#### JSDoc/TSDoc

Use `/** ... */` documentation comments for exported APIs and important internal
helpers when consumers or maintainers need information that TypeScript does not
express.

Start with a short, behavior-focused summary in present tense:

```ts
/**
 * Creates an isolated Prisma Client with the application adapter and extensions.
 *
 * Use this for tests and scripts. Application code should use
 * `usePrismaClient()` so development reloads reuse one connection pool.
 */
export function createPrismaClient() {
  // ...
}
```

Use tags only when they add contract information:

- `@param` explains meaning, units, valid values, defaults, or relationships
  between parameters that names and types do not already communicate.
- `@returns` explains a non-obvious result, sentinel value, or ownership rule.
- `@throws` identifies anticipated errors consumers are expected to handle.
- `@remarks` records an important invariant or cross-layer contract.
- `@example` demonstrates an API whose correct use is not obvious.
- `@deprecated` names the replacement and, when useful, the removal condition.
- `@see` links to a related code, or to a related API, or to a design document.

Do not treat tags as a completeness checklist. Omit a tag when it would only
repeat the TypeScript signature, a framework convention, or standard behavior
of a dependency already established in the codebase. Components normally do not
need `@param` or `@returns` when their props and rendered output are clear from
the signature and JSX.

Describe a declaration according to what it is:

- Use behavior-focused verbs for functions, methods, and callable procedures.
- Use noun-focused summaries such as "Schema for..." or "Configuration for..."
  for schemas, maps, configuration objects, and other values.
- Document thrown errors by stable condition or public code when that is what
  consumers handle. Do not restate the error wrapper used throughout the
  codebase.

Avoid repeating TypeScript types, function names, obvious parameter names, or
library usage knowledge. For example, `/** Creates a Task. */` above a function
named `create` adds no useful contract. Document validation beyond the declared
schema, side effects, permissions, error translation, or other project-specific
behavior instead, if any of those are relevant.

Keep documentation proportional and structurally consistent. Declarations at
the same level in a file should receive comparable treatment, but not
necessarily identical tags or length. A reader who starts at a declaration
after reading the module header should have the local context needed to use or
modify it without the comment repeating shared file-level context.

#### Inline comments

Use inline comments immediately above the code they explain. Prefer a complete
sentence that states why the behavior is necessary.

```ts
// Prisma cursors are inclusive, so skip the cursor row on subsequent pages.
skip: input.page.cursor_id ? 1 : 0,
```

Remove comments that merely label visible operations:

```ts
// Parse JSON.
app.use(express.json());
```

TODO comments must include a clear completion condition and, when available, an
issue link or owner. Do not leave open-ended reminders that cannot be acted on.

#### Navigation markers

Use `// MARK:` markers only as navigation landmarks in long, flat files where
several peer sections are easier to scan from the editor minimap. They are not
documentation comments and should not explain behavior, rationale, TODOs, or
contracts.

When a marker is useful, use this shape:

```ts
// --------------------------------------------------------------------------
// MARK: Find Many
// --------------------------------------------------------------------------
```

Keep the marker title short and in Title Case. Keep each horizontal divider at
or below 80 characters for the whole line, including indentation. Do not copy
the divider style for ordinary comments.

Prefer extraction, clearer naming, or a module-level comment when the marker is
trying to compensate for a file that has too many responsibilities. Avoid
`#region` and `#endregion`; these markers are for visual navigation, not for
defining foldable code blocks.

### Writing style

- Write for the expected reader and assume only the prerequisites the document
  states.
- Use active voice, direct language, and consistent terminology.
- Put conditions before instructions: "When changing package exports, run..."
- Use headings and lists to make long guidance scannable.
- Use numbered steps for ordered procedures and bullets for unordered choices.
- Use descriptive link text instead of "click here" or bare URLs.
- Keep commands runnable from the documented directory. Keep illustrative code
  structurally valid, clearly labeled, and consistent with current conventions.
- Prefer exact commands, paths, inputs, outputs, and failure conditions over
  words such as "usually," "properly," or "as needed."

### Review checklist

Before finishing a change, verify that its documentation:

- Matches the current behavior and uses the current names and commands.
- Gives the reader enough context to act without reading unrelated files.
- Explains non-obvious decisions and omits facts the code already states.
- Uses commands that run from the documented location and code examples that
  are structurally valid, current, and explicit about placeholders.
- Links to one authoritative source instead of duplicating guidance.
- Contains no secrets, obsolete TODOs, commented-out code, or speculative plans.
- Remains concise enough that maintainers are likely to keep it current.

### References

- [OpenAI: Custom instructions with `AGENTS.md`][openai-agents]
- [OpenAI: Codex best practices][openai-best-practices]
- [OpenAI: Prompting Codex][openai-prompting]
- [OpenAI: Codex customization][openai-customization]
- [TSDoc: Documentation comment standard][tsdoc]
- [TypeScript: JSDoc reference][typescript-jsdoc]
- [Google developer documentation style guide][google-style]

[google-style]: https://developers.google.com/style/highlights
[openai-agents]: https://developers.openai.com/codex/guides/agents-md
[openai-best-practices]: https://developers.openai.com/codex/learn/best-practices
[openai-customization]: https://developers.openai.com/codex/concepts/customization
[openai-prompting]: https://developers.openai.com/codex/prompting
[tsdoc]: https://tsdoc.org/
[typescript-jsdoc]: https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html