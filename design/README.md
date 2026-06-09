# Design Reference Files

This is where you place your **target design**—the prototypes, specs, and brand
assets that your blocks are built to match.

> [!IMPORTANT]
> Everything in this folder except `.gitignore` and this `README.md` is
> git-ignored by default. This lets you drop in proprietary assets, large font
> files, or tool exports without worrying about accidental commits. See
> [Tracking files in git](#tracking-files-in-git) if you want to commit
> specific files.

## What to put here

| File type | Examples | Purpose |
|---|---|---|
| **Design system spec** | `DESIGN.md`, `brand-spec.md` | Define your colors, typography, spacing, and component rules |
| **Prototype HTML** | `index.html`, `dashboard.html` | Static screen exports from Figma, Open Design, or similar tools |
| **Design handoff** | `DESIGN-HANDOFF.md` | Implementation guidance for translating prototypes to code |
| **Design manifest** | `DESIGN-MANIFEST.json` | Machine-readable map of screens, tokens, interactions, and viewports |
| **Brand assets** | Font files, icons, logos | Fonts and images referenced by prototypes or the production UI |

You can organize files however you like—flat or nested. The only requirement is
that this folder stays self-contained; the rest of the codebase does not import
from here at build time.

## Workflow

1. **Add your design files** to this folder.
2. **Open prototype HTML** in a browser to see the target UI.
3. **Read your specs** (`DESIGN.md`, `brand-spec.md`, etc.) for color tokens,
   typography stacks, and component rules.
4. **Build blocks** under `apps/web/app/blocks/` using components from
   `packages/ui/`, matching the design intent.
5. **Compare** — run `pnpm dev` and use the viewer at `localhost:3000` to
   visually compare rendered blocks against the prototypes.
6. **Iterate** until the blocks match.

## Tracking files in git

The `.gitignore` in this folder blocks everything by default:

```gitignore
*
!.gitignore
!README.md
```

To track specific design files, add negation rules:

```gitignore
*
!.gitignore
!README.md
!DESIGN.md
!brand-spec.md
!DESIGN-HANDOFF.md
!DESIGN-MANIFEST.json
```

For large binary assets (high-res images, video recordings, full font families),
consider keeping them local-only and documenting their expected filenames here
so other contributors know what to obtain separately.

## For AI coding agents

When implementing UI from design files in this folder:

- Read `DESIGN-MANIFEST.json` first (if present) for a machine-readable
  implementation plan.
- Extract design tokens from prototype HTML and spec files before writing
  framework components.
- Implement each HTML screen as its own block/route—do not merge multiple
  screens into a single page.
- Follow the responsive viewport matrix in the manifest for testing.
- If a `DESIGN-HANDOFF.md` exists, follow its coding checklist.