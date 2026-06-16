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
7. **Namespace Prefix:** If you change `PROJECT_PREFIX`, update it simultaneously in `src/constants`, `postcss.config.cjs`, and `global.css`.

## Testing Changes
- Run `pnpm compile && pnpm lint && pnpm test && pnpm build && pnpm audit:css` before committing.
- `pnpm test` executes Vitest tests (using happy-dom and WXT's `fakeBrowser`) to verify core logic, event isolation, and state management.
- For tests that require a layout engine (like font-size clamping or hit-testing floating layers), perform manual testing in a real browser.
- **Manual Testing:** Run a local server (`python3 -m http.server -d test-pages 8787`) and open `tw3-host.html`. Test the UI while the browser window is in the foreground, as backgrounding the window can pause animations and cause false negatives for floating components.
- When verifying visual correctness, use `elementsFromPoint` and check computed values, rather than just inspecting DOM presence.

## Important Files
- `src/surface/`: Contains the core setup for document, shadow DOM, satellites, and context.
- `src/react-app/managers/VisualManager/`: The main integration point for Mantine (`MantineRegistry`). When building new managers, mirror this file structure. Ensure floating components retain their configured `zIndex` and `floatingStrategy` to prevent them from rendering underneath other page elements.
- `postcss.config.cjs`: Handles the `--tw-` to `--aie-tw-` prefixing and re-anchors styles to `:root,:host`.
- `scripts/audit-css-vars.mjs`: Script to verify that CSS variables are correctly scoped.
