# aie-wxt-mantine-surface-template

**English** | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md)

[![Use this template](https://img.shields.io/badge/Use_this_template-2ea44f?style=flat&logo=github&logoColor=white)](https://github.com/AIEPhoenix/aie-wxt-mantine-surface-template/generate)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
![WXT](https://img.shields.io/badge/WXT-0.20-67D55E)
![Mantine](https://img.shields.io/badge/Mantine-9-339AF0?logo=mantine&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

A production-ready boilerplate for building browser extension user interfaces. Write your UI once and deploy it consistently across popups, side panels, options pages, standalone tabs, and injected shadow DOM environments.

It guarantees comprehensive CSS isolation: your extension styles will not affect the host page, and the host page's CSS will not interfere with your extension.

**Technology Stack:** WXT 0.20, `@webext-core` (messaging and proxy-service), Mantine 9.3 (native CSS variables, no Emotion dependency), Tailwind 4 (strictly namespaced), and CSS Modules.

## Why this template?

- **Write the UI once, mount it anywhere** — one component tree renders in the popup, side panel, options page, a standalone tab, or injected into any web page.
- **Real shadow-DOM isolation, not hope** — the known style-penetration vectors are handled and locked down by `pnpm audit:css`.
- **Builds Chrome will actually load** — an ASCII-output plugin for the Vite 8 / rolldown path, guarded by `pnpm audit:ascii` (wxt#353).
- **Mantine v9 on native CSS variables** — no Emotion runtime; color scheme, direction, and primary color stay in sync across every surface.
- **Typed, tested, documented** — TypeScript, vitest unit tests, and multilingual docs out of the box.

> [!NOTE]
> This is a foundational template rather than an exhaustive framework. The code within `src/` addresses the intricate plumbing inherent to browser extension development. Application-specific logic—such as authentication flows, HTTP/SSE clients, and complex build environments—is deliberately omitted. Please refer to the [Patterns](#6-patterns-optional) section for guidance on these implementations.

---

## 1. Getting Started

```bash
pnpm install
pnpm dev                 # Chrome: launches a development browser with the extension loaded
pnpm dev:firefox         # Firefox
```

`pnpm dev` also initializes a local test host page at `http://localhost:8787` for evaluating in-page injected UIs (executing `python3 -m http.server -d test-pages 8787` internally).

### Customization

1. **Configure the Namespace:** Update the `PROJECT_PREFIX` in `src/constants`. Ensure this remains synchronized across `postcss.config.cjs` and `global.css`. This prefixes your CSS variables and the core `.aie-surface-root` class to prevent conflicts with the host page.
2. **Define the Manifest:** Adjust the `name` and `permissions` within the `manifest` function in `wxt.config.ts`. Target Manifest V3 (MV3); WXT automatically manages the down-conversion for Firefox.
3. **Pin the Extension ID (Optional):** Copy `.env.example` to `.env` and set the `WXT_EXTENSION_KEY`. This securely injects your manifest `key` via environment variables. Only variables prefixed with `WXT_` or `VITE_` are included in the build output. Always maintain secrets in `.env`, not in committed configuration files.
4. **Add UI Surfaces:** Every entry point under `src/entrypoints/` mounts a React application from `src/react-app/apps/`. To introduce a new surface, duplicate an existing app directory and configure the corresponding entry point.

### Build & Deploy

```bash
pnpm compile && pnpm lint && pnpm build
pnpm test                # vitest: evaluates lifecycle, storage, and logic invariants (happy-dom + fake-browser)
pnpm audit:css           # Validates CSS variable scoping (recommended after updating Tailwind/Mantine)
pnpm audit:ascii         # Asserts build artifacts are pure ASCII (prevents Chrome CJK/UTF-8 load-time rejections)
pnpm zip                 # Packages a zip archive for the Chrome Web Store (`pnpm zip:firefox` for AMO)
```

---

## 2. Project Architecture

```text
src/
├── entrypoints/      # WXT entry points (auto-discovered) — lightweight mount layers
│   ├── background.ts
│   ├── popup/        # index.html + main.tsx (similar for options/, sidepanel/, tab/)
│   └── content/      # in-page content script (index.tsx)
├── react-app/        # Core application logic
│   ├── apps/         # Individual applications per entry point
│   ├── components/   # Shared UI components
│   ├── managers/     # VisualManager (theme synchronization), Mantine registry
│   ├── hooks/        # Extension-specific hooks (e.g., useExtStorage)
│   └── styles/       # global.css, Mantine SCSS mixins
├── surface/          # Isolation infrastructure: documentSurface, createShadowSurfaceUi, createSatellite
├── core/             # Cross-context communication: messaging and RPC
└── constants/        # PROJECT_PREFIX, Z_INDEX tiers, shared design tokens
public/               # Static assets copied directly to the build output
vite-plugins/         # Custom build plugins (e.g., UTF-8 string escaping)
wxt.config.ts         # Configuration for WXT, Vite, manifest definitions, and browser targets
```

`src/entrypoints/` is the only directory automatically discovered by WXT. All other directories contain standard application code imported via the `@/` alias, while WXT-specific APIs are accessed through the virtual `#imports` module. Each entry point serves as a minimal shim to mount a specific application from `src/react-app/apps/`.

> **Architectural Decision:** This structure intentionally diverges from WXT's flat auto-import convention (which typically places `hooks/` and `utils/` at the source root). By encapsulating application code within `react-app/` and mandating explicit imports, we enforce strict module boundaries. WXT's `#imports` functionality remains fully supported where necessary.

---

## 3. Core Concepts

| Surface Type  | Factory Method                             | Primary Use Case                                    | Instance Limit |
| ------------- | ------------------------------------------ | --------------------------------------------------- | -------------- |
| **Document**  | `documentSurface()` + `renderSurfaceApp()` | Popups, side panels, options pages, standalone tabs | 1 per page     |
| **Shadow**    | `createShadowSurfaceUi()`                  | Comprehensive, isolated in-page UI injections       | 1 per frame¹   |
| **Satellite** | `createSatellite()`                        | Lightweight UI components (e.g., toolbars, badges)  | Unlimited      |
| **Content**   | N/A (Refer to Patterns)                    | Direct mutation or styling of the host page         | N/A            |

¹ While `createShadowSurfaceUi` technically supports multiple instances, the satellite registry currently binds to a single host.

**General Guidelines:**

- **UI Isolation:** Render React DOM elements strictly within the isolated world. Reserve the main world for headless logic that explicitly requires the host page context.
- **Surface vs. Content:** If the host page must dictate the layout, utilize standard DOM elements (the Content track). If the extension requires full control over theme and layout, deploy an isolated Surface.

### The Surface Environment (`SurfaceEnv`)

Whether rendering within a popup document or a shadow DOM, the environmental differences are abstracted into a unified interface (`surface/defs.ts`), which is consumed by the `MantineRegistry`:

```typescript
interface SurfaceEnv {
  kind: 'document' | 'shadow';
  rootElement: HTMLElement; // The Mantine variable root and data-mantine-* attribute host
  portalTarget: HTMLElement; // The injection target for floating layers (Modals, Popovers)
  scale: number; // Rem compensation (16 / host's actual rem base). Always 1 for documents.
  colorSchemeStrategy: 'extension' | 'force-light' | 'force-dark';
}
```

**Avoid direct manipulation of `document.body`.** Always utilize the `useSurface()` hook to interact with the environment safely.

### Satellites

Satellites are performant, highly-targeted UI components injected into the host page. The host surface initializes the primary React providers and styles once. Subsequently, each satellite requires only an empty shadow container, shared `CSSStyleSheet` references, and a React portal.

Render content into a `SatelliteOutlet` using `createSatellite()`. The mounting of the outlet is automatically managed by `renderSurfaceApp`.

Satellites incorporate `isolateEvents` by default, ensuring that user keyboard interactions within the extension do not inadvertently trigger host page shortcuts. A `MutationObserver` monitors the DOM to maintain satellite alignment:

- **Unmounting:** Occurs instantaneously if the host element or anchor is removed from the DOM.
- **Relocation:** Adapts seamlessly if the anchor element shifts position on the page.

Styles are distributed via constructable stylesheets. If the browser does not support them, the system falls back to cloning `<style>` tags. (Note: During development, restrictive Content Security Policies may block injected `<link>` elements. Always verify styling against a production build, which securely inlines `<style>` tags.)

### Theming

`useVisual()` is the primary hook for all theme-related operations. It replaces direct usage of Mantine's native hooks and provides:

- Color scheme management (`light`, `dark`, or `auto`).
- Text direction control (`ltr` / `rtl` via Mantine's `DirectionProvider`).
- Primary color generation. Providing a Mantine palette name (e.g., `blue`) or a hexadecimal code dynamically generates a complete 10-shade palette.

### State Synchronization

State synchronization across all surfaces is managed seamlessly via WXT storage. Modifying the theme within the popup will update the in-page UI in real-time.

For synchronizing custom reactive state, utilize the `useExtStorage` hook to wrap `storage.defineItem` across all instances. Ensure that object or array fallbacks utilize stable, module-level references.

### Communication

The template provides two strictly-typed channels for cross-context communication:

- **Messaging** (`core/messaging`): Registering an entry in `ProtocolMap` automatically provisions type-safe `sendMessage` and `onMessage` utilities, eliminating string-based actions and manual listener management.
- **RPC** (`core/rpc`): Define a service class, register it within the background script, and invoke it from any surface via `@webext-core/proxy-service` as a local function. This is the recommended approach for heavy background operations, such as cross-origin requests, large downloads, or long-running tasks.

---

## 4. Shadow DOM Considerations

While the Shadow DOM provides robust encapsulation, CSS inheritance can still introduce edge cases. The following strategies address common issues:

| Issue                  | Symptom                                             | Resolution                                                                        |
| ---------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------- |
| Inherited properties   | Host page typography affects extension UI           | Apply strict typography resets on `.aie-surface-root`                             |
| `rem` sizing leaks     | Host's `font-size` scales the UI disproportionately | Set `theme.scale = 16 / real-rem` to counteract the host's base                   |
| `@property` collisions | Tailwind CSS variables conflict with the host       | Rename variables from `--tw-` to `--aie-tw-` (configured in `postcss.config.cjs`) |
| Tailwind `rem` bugs    | Tailwind spacing breaks due to host `rem` scaling   | Apply `calc(x * var(--mantine-scale, 1))` on `.aie-surface-root`                  |
| Modal `lockScroll`     | Modals freeze the underlying host page              | Set `lockScroll: false` on all Modals and Drawers                                 |
| `lightningcss` bugs    | High `z-index` values are unexpectedly collapsed    | Restrict `Z_INDEX` constants to 6 significant digits or fewer                     |
| External CSS overrides | Host CSS bypasses extension encapsulation           | Enforce framework variables strictly within `.aie-surface-root`                   |

### CSS Variables Strategy

All root-level CSS variables are securely scoped within `.aie-surface-root` inside the shadow tree. This isolates them from external `:root` or `:host` selectors. Execute `pnpm audit:css` to verify the integrity of your design tokens.

**Z-index Hierarchy:** Defined in `src/constants` and `global.css`.
Order: `floatUi < mainUi < modal < popover < notification < max`.

---

## 5. Architectural Guidelines

1. **Avoid `document.body`:** Rely on `useSurface()` for all DOM interactions.
2. **Preserve Host Integrity:** Modals, Drawers, and Portals must not modify the host's `document` or `body` styles.
3. **No Emotion in Content UI:** Libraries that inject styles into `document.head` are incompatible with shadow roots. Utilize the provided CSS modules and Mantine's native CSS variables.
4. **Deploy Satellites for Secondary UI:** Avoid initializing a complete surface for minor components. Route them through a satellite.
5. **Maintain a Simple Content Track:** Do not apply Tailwind classes or React nodes for raw host-page mutations. Rely on vanilla DOM manipulation and explicitly prefixed CSS classes.
6. **Isolate Authentication:** Keep sensitive UI workflows strictly out of the main world.
7. **Constrain Floating Components:** Configure Popovers, Tooltips, and Menus to use `zIndex: Z_INDEX.popover` and `floatingStrategy: 'fixed'`.
8. **Enforce the Namespace:** Ensure `PROJECT_PREFIX` is perfectly synchronized across `src/constants`, `postcss.config.cjs`, and `global.css`.

---

## 6. Patterns (Optional)

The following patterns outline recommended approaches for advanced implementations.

### 6.1 The Content Track

To highlight text or modify host content, implement a vanilla DOM module within the content script. The extension should manage the logic while allowing the host page to dictate the styling.

- Utilize `data-aie-*` attributes as DOM markers.
- For complex interactions, mount a satellite within the target node.

### 6.2 The Main-World Bridge

Interact with the main world only when access to host page JavaScript APIs is strictly required. Execute the necessary operations and immediately transmit the data back to the isolated world via `@webext-core/messaging/page`.

### 6.3 Miscellaneous

- **Build Encoding:** `vite-plugins/to-utf8.ts` enforces UTF-8 escaping for non-ASCII characters in emitted chunks. This prevents load-time rejections by Chrome due to "non-UTF-8" errors in CJK or emoji-heavy bundles. This plugin is active by default and ignores pure-ASCII output.
- **Environment-Specific Builds:** To implement development versus production logic, branch conditionally on `mode` within the `manifest` function in `wxt.config.ts`.
- **Custom Storage Hooks:** Refer to `src/react-app/hooks/useExtStorage.ts` for implementation details.

Application-specific implementations (e.g., custom HTTP clients, OAuth via `chrome.identity`, DOM selection parsers) should be added to `src/services` or `src/react-app/utils` as required.

### 6.4 Adding Mount Points

Popups, side panels, options pages, and tabs are pre-configured with `documentSurface()`. To introduce a new entry point, duplicate an existing one and integrate it accordingly.

---

## 7. Known Limitations

- A satellite registry currently binds to a single host surface per frame.
- Rem scale is calculated once during initialization. If the host dynamically alters its root font size subsequently, the extension UI will not automatically rescale.
- The `MutationObserver` monitors the entire DOM tree. In highly dynamic Single Page Applications (SPAs), implement explicit teardown logic to optimize CPU utilization.
- Event isolation is only guaranteed during the bubble phase.

---

## 8. Stack & References

The foundational dependencies this template is built on:

| Package                                   | Role                                                                  | Docs                                                         |
| ----------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| WXT                                       | Extension framework — entrypoints, manifest generation, dev/build/zip | [wxt.dev](https://wxt.dev)                                   |
| `@webext-core` (messaging, proxy-service) | Typed cross-context messaging and background RPC                      | [webext-core.aklinker1.io](https://webext-core.aklinker1.io) |
| Mantine                                   | UI components and theming on native CSS variables                     | [mantine.dev](https://mantine.dev)                           |
| React (via `@wxt-dev/module-react`)       | UI runtime and the WXT React module                                   | [react.dev](https://react.dev)                               |
| Tailwind CSS                              | Namespaced utility CSS (v4, lightningcss)                             | [tailwindcss.com](https://tailwindcss.com)                   |
| TypeScript                                | Language and type checking                                            | [typescriptlang.org](https://www.typescriptlang.org)         |
| Vite (rolldown)                           | The bundler WXT builds on                                             | [vite.dev](https://vite.dev)                                 |
| Vitest                                    | Unit tests (happy-dom + fake-browser)                                 | [vitest.dev](https://vitest.dev)                             |

Exact versions are pinned in `package.json`.
