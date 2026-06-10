<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Coding and Documentation Guidelines

Before writing code, architectural changes, or documentation, you **MUST** read [CONTRIBUTING.md](./CONTRIBUTING.md) to understand the required repository-wide contributor practices, coding patterns, and documentation conventions.

## Specialized Agent Capabilities

The repository provides modular skills and craft rules under `.agents/`. Apply the appropriate capability by reading its instruction file when your task matches its description.

### Using Skills

When a task requires a specific capability, read its instructions first:
```bash
cat .agents/skills/<skill-name>/SKILL.md
```

- **`agent-browser`**: Browser automation CLI for AI agents.
- **`algorithmic-art`**: Create generative art using p5.js with seeded randomness so every render is reproducible.
- **`brainstorming`**: Transform rough ideas into fully-formed designs through structured questioning and alternative exploration.
- **`color-expert`**: Color science expert skill with 286K words of reference material covering OKLCH/OKLAB, palette generation, accessibility/contrast, color naming, pigment mixing, and historical color theory.
- **`creative-director`**: AI creative director with recursive self-assessment: 20+ methodologies (SIT, TRIZ, Bisociation, SCAMPER, Synectics), 3-axis evaluation calibrated against Cannes/D&AD/HumanKind, 5-phase process from brief to presentation.
- **`d3-visualization`**: Teaches the agent to produce D3 charts and interactive data visualizations.
- **`design-brief`**: Parse a structured design brief written in I-Lang protocol format into a concrete design spec.
- **`design-consultation`**: Build a complete design system from scratch with creative risks and realistic product mockups.
- **`design-md`**: Create and manage DESIGN.md files.
- **`design-review`**: Designer Who Codes: visual audit then fixes with atomic commits and before/after screenshots.
- **`doc`**: 
- **`docx`**: Create, edit, and analyze Word documents with tracked changes, comments, and formatting.
- **`enhance-prompt`**: Improve prompts with design specs and UI/UX vocabulary.
- **`export-download-debugging`**: Diagnose and fix browser, preview, or Electron export/download failures, especially image export issues involving Save As, Blob/Data URLs, the File System Access API, createWritable failures, and 0 KB files.
- **`faq-page`**: A Frequently Asked Questions (FAQ) page with collapsible accordion sections, search functionality, and category filtering.
- **`frontend-design`**: Create distinctive, production-grade frontend interfaces with strong visual direction, polished typography, considered layout, and working HTML/CSS/JS or framework code.
- **`frontend-dev`**: Full-stack frontend with cinematic animations, AI-generated media via MiniMax API, and generative art.
- **`frontend-skill`**: Create visually strong landing pages, websites, and app UIs with restrained composition.
- **`frontend-slides`**: Generate animation-rich HTML presentations with visual style previews.
- **`full-page-screenshot`**: Capture full-page screenshots of web pages via Chrome DevTools Protocol with zero dependencies.
- **`gpt-tasteskill`**: Elite UX/UI & Advanced GSAP Motion Engineer.
- **`gsap-core`**: Official GSAP skill for the core API — gsap.to(), from(), fromTo(), easing, duration, stagger, defaults, gsap.matchMedia() (responsive, prefers-reduced-motion).
- **`gsap-frameworks`**: Official GSAP skill for Vue, Svelte, and other non-React frameworks — lifecycle, scoping selectors, cleanup on unmount.
- **`gsap-performance`**: Official GSAP skill for performance — prefer transforms, avoid layout thrashing, will-change, batching.
- **`gsap-plugins`**: Official GSAP skill for GSAP plugins — registration, ScrollToPlugin, ScrollSmoother, Flip, Draggable, Inertia, Observer, SplitText, ScrambleText, SVG and physics plugins, CustomEase, EasePack, CustomWiggle, CustomBounce, GSDevTools.
- **`gsap-react`**: Official GSAP skill for React — useGSAP hook, refs, gsap.context(), cleanup.
- **`gsap-scrolltrigger`**: Official GSAP skill for ScrollTrigger — scroll-linked animations, pinning, scrub, triggers.
- **`gsap-timeline`**: Official GSAP skill for timelines — gsap.timeline(), position parameter, nesting, playback.
- **`gsap-utils`**: Official GSAP skill for gsap.utils — clamp, mapRange, normalize, interpolate, random, snap, toArray, wrap, pipe.
- **`hand-drawn-diagrams`**: Generate hand-drawn Excalidraw diagrams from a prompt — animated SVG, hosted edit link, and PNG export.
- **`image-to-code-skill`**: Elite website image-to-code skill for Codex.
- **`impeccable-design-polish`**: Follow-up design polish skill inspired by Impeccable.
- **`marketing-psychology`**: Apply psychological principles and behavioral science to copy and design.
- **`minimalist-skill`**: Clean editorial-style interfaces.
- **`minimax-docx`**: Professional DOCX document creation and editing using OpenXML SDK.
- **`minimax-pdf`**: Generate, fill, and reformat PDFs with a token-based design system and 15 cover styles.
- **`mockup-device-3d`**: Static iPhone and MacBook 3D-style showcase with real HTML embedded on screens, glass-lens refraction, and 360-degree turntable composition.
- **`nanobanana-ppt`**: AI-powered PPT generation with document analysis and styled images via the NanoBanana stack.
- **`output-skill`**: Overrides default LLM truncation behavior.
- **`paywall-upgrade-cro`**: Design and optimize upgrade screens, paywalls, and upsell modals.
- **`pdf`**: Extract text, create PDFs, and handle forms.
- **`plan-design-review`**: Senior Designer review: rates each design dimension 0-10, explains what a 10 looks like, and flags AI Slop signals.
- **`platform-design`**: 300+ design rules from Apple HIG, Material Design 3, and WCAG 2.2 for cross-platform apps.
- **`pptx`**: Read, generate, and adjust PowerPoint slides, layouts, and templates.
- **`pptx-generator`**: Create and edit PowerPoint presentations from scratch with PptxGenJS — MiniMax's production-tested deck pipeline.
- **`pptx-html-fidelity-audit`**: Audit a python-pptx export against its source HTML deck, identify layout/content drift (footer overflow, cropped content, missing italic/em, lost styling, off-rhythm spacing), and re-export with strict footer-rail + cursor-flow layout discipline.
- **`pr-feedback-quality-gate`**: Safely track pull request feedback, resolve review comments or merge conflicts, validate fixes, and use a read-only cross-review before committing or pushing follow-up changes.
- **`redesign-skill`**: Upgrades existing websites and apps to premium quality.
- **`release-notes-one-pager`**: Release notes one-page HTML with highlights, Added, Fixed, Breaking changes, Known issues, and Upgrade note.
- **`remotion`**: Programmatic video creation with React.
- **`research-decision-room`**: Turn messy user research notes, interviews, support tickets, surveys, and product context into an evidence-backed decision room: a single HTML artifact with an evidence ledger, theme map, confidence heatmap, opportunity matrix, decision memo, and experiment queue.
- **`screenshot`**: Capture desktop, app windows, or pixel regions across OS platforms.
- **`screenshots-marketing`**: Generate marketing screenshots with Playwright.
- **`shadcn-ui`**: Build UI components with shadcn/ui.
- **`shader-dev`**: GLSL shader techniques for ray marching, fluid simulation, particle systems, and procedural generation.
- **`slack-gif-creator`**: Create animated GIFs optimized for Slack with validators for size constraints and composable animation primitives.
- **`slides`**: Create and edit .pptx presentation decks with PptxGenJS.
- **`soft-skill`**: Teaches the AI to design like a high-end agency.
- **`stitch-loop`**: Iterative design-to-code feedback loop.
- **`stitch-skill`**: Semantic Design System Skill for Google Stitch.
- **`taste-skill`**: Anti-slop frontend skill for landing pages, portfolios, and redesigns.
- **`taste-skill-v1`**: The original v1 taste-skill, preserved for projects depending on its exact behavior.
- **`theme-factory`**: Apply professional font and color themes to artifacts including slides, docs, reports, and HTML landing pages.
- **`threejs`**: Three.js skills for creating 3D elements and interactive experiences in the browser — scenes, materials, controls, and post-processing.
- **`ui-skills`**: Opinionated, evolving constraints to guide agents when building interfaces.
- **`ui-ux-pro-max`**: Catalog-only UI/UX Pro Max entry.
- **`web-artifacts-builder`**: Build complex claude.ai HTML artifacts with React and Tailwind.
- **`web-design-guidelines`**: Web design guidelines and standards by the Vercel engineering team.

### Using Crafts

When working on UI or design, read the relevant craft rules first:
```bash
cat .agents/craft/<craft-name>.md
```

- **`README.md`**: Brand-agnostic craft knowledge.
- **`accessibility-baseline.md`**: Universal rules for the legal floor of accessibility plus the craft
- **`animation-discipline.md`**: Universal rules for when motion earns its place in a UI and what numbers
- **`anti-ai-slop.md`**: Concrete, checkable rules that distinguish "designed by a human who has
- **`color.md`**: Universal color rules applied on top of the active `DESIGN.md`.
- **`form-validation.md`**: Universal rules for form validation lifecycle, error wiring beyond the
- **`laws-of-ux.md`**: Universal cognitive, perceptual, and behavioral heuristics that decide
- **`rtl-and-bidi.md`**: Universal rules for right-to-left layout and bidirectional text.
- **`state-coverage.md`**: Universal rules for what every interactive surface must render.
- **`typography-hierarchy-editorial.md`**: Extends `typography.md` + `typography-hierarchy.md`.
- **`typography-hierarchy.md`**: Shared hierarchy contracts that layer on top of `typography.md`.
- **`typography.md`**: Universal typography rules that apply on top of any `DESIGN.md`.
