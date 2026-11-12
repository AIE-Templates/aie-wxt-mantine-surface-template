# Developer Guide — aie-wxt-mantine-surface-template

This project is a browser extension template built with WXT, React, and Mantine (without Emotion). It supports injecting UI across different extension surfaces consistently.

Please review `README.md` for the overall architecture and setup instructions. This document covers critical technical requirements and testing guidelines for contributing.

## Current Setup
The template uses Mantine 9.3.1 and React 19.2, and includes Vitest for logic and DOM tests. The core codebase provides foundational extension features, while application-specific logic should be added as needed.

## Critical Requirements
To ensure the extension functions correctly and avoids conflicts with host pages, please adhere to the following rules:

1. **CSS Variable Scope:** All root-level CSS variables must be declared on `.aie-surface-root`. This isolates styles within the shadow DOM. `postcss.config.cjs` handles this by appending `.aie-surface-root` to `:root` and `:host`. Run `pnpm audit:css` if you update the style pipeline.
2. **Avoid Emotion:** Use Mantine's native CSS variables. Third-party libraries that rely on Emotion may inject styles directly into `document.head`, causing styling issues.
3. **Avoid Host Mutation:** Shadow components must not modify the host's global `document` or `body`. For instance, keep `lockScroll: false` on Modals/Drawers, and retain `keepTransitions: true` when switching color schemes (`registry.tsx`) to prevent unintended global style changes.
4. **Surface Context:** Always use `useSurface()` instead of `document.body` for UI placement.
5. **Z-Index Precision:** Ensure `Z_INDEX` values are 6 significant digits or fewer. `lightningcss` parses CSS variables to 32-bit floats, which can cause large integers to collapse.
6. **Satellite Constraints:** Satellites provide keyboard event isolation (`isolateEvents`) and maintain their position relative to their anchor node. Floating layers should use portals to attach to the host surface.
7. **Namespace Prefix:** `PROJECT_PREFIX` has a single source of truth in `prefix.cjs` (repo root). `src/constants` re-exports it, and `postcss.config.cjs` and `scripts/audit-css-vars.mjs` read it directly, so they all follow one literal. The only place that still mirrors the prefix by hand is `global.css` (CSS can't import) — change it there too. `pnpm test` guards that mirror: the `Z_INDEX` suite fails loudly if `global.css` drifts from the prefix.

## Testing Changes
- Run `pnpm compile && pnpm lint && pnpm test && pnpm build && pnpm audit:css && pnpm audit:ascii && pnpm audit:surface` before committing.
- `pnpm test` executes Vitest tests (using happy-dom and WXT's `fakeBrowser`) to verify core logic, event isolation, and state management.
- For tests that require a layout engine (like font-size clamping or hit-testing floating layers), perform manual testing in a real browser.
- **Manual Testing:** Run a local server (`python3 -m http.server -d test-pages 8787`) and open `tw3-host.html`. Test the UI while the browser window is in the foreground, as backgrounding the window can pause animations and cause false negatives for floating components. For strict host-CSP verification, open `csp-strict-host.html` (a fully inline-free page with `script-src 'self'; style-src 'self'; style-src-attr 'none'`) against a `pnpm build` output and confirm the surface, satellites, modals and color-scheme toggle all render without adding unscoped host styles. WXT's single namespaced `@property` registration style is expected; theme changes must not add transition styles.
- When verifying visual correctness, use `elementsFromPoint` and check computed values, rather than just inspecting DOM presence.

## Important Files
- `src/surface/`: Contains the core setup for document, shadow DOM, satellites, and context.
- `src/react-app/managers/VisualManager/`: The main integration point for Mantine (`MantineRegistry`). When building new managers, mirror this file structure. Ensure floating components retain their configured `zIndex` and `floatingStrategy` to prevent them from rendering underneath other page elements.
- `postcss.config.cjs`: Handles the `--tw-` to `--aie-tw-` prefixing and re-anchors styles to `:root,:host`.
- `scripts/audit-css-vars.mjs`: Script to verify that CSS variables are correctly scoped.

## Optional customization

- App tokens/defaults live in `src/react-app/theme.ts`; the initial primary-color preference lives in `theme-defaults.ts`. Surface isolation defaults merge last.
- Direction context and `dir` attributes belong to each surface root; do not restore Mantine's document-global DirectionProvider.
- External `ColorSchemeSource` values are supported without loading host detection. `src/surface/addons/host-scheme.ts` is an opt-in accessory only.
- RPC clients import `contract.ts`; registration and implementation stay in `impl.ts`, imported by background.
- See `docs/surface-recipes.md` for frame scope and WXT lifecycle examples.

## WXT 0.21 and bundled surface CSS

- Use Node.js 22.12+; `web-ext` is an explicit development dependency. Keep the generated strict TypeScript options enabled.
- WXT now mounts into a div, not a nested html/head/body document. Do not depend on the old structure.
- Content entries use `cssInjectionMode: 'manual'`, import `virtual:surface-css`, and pass it as the `css` surface option. Normal global and CSS Module imports are collected automatically by `vite-plugins/inline-surface-css.ts`. Do not fetch public extension stylesheets.
- Keep the emitted CSS audit asset; `audit:surface` checks that exactly this CSS is embedded in the JS and absent from manifest injection/resource declarations. Run Chrome and Firefox build/audit variants.
- Use `wxt/testing/vitest-plugin` and `wxt/testing/fake-browser` instead of the removed `wxt/testing` barrel.
