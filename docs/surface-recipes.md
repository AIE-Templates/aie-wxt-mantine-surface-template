# Optional surface recipes

[English](surface-recipes.md) | [简体中文](surface-recipes.zh-CN.md) | [日本語](surface-recipes.ja.md) | [한국어](surface-recipes.ko.md)

These are opt-in examples, not additional entrypoints or a required project structure. The template's default appearance and injection scope are unchanged.

## Application theme

Edit `src/react-app/theme.ts` for fonts, named palettes (including Mantine virtual colors), and component defaults. `src/react-app/theme-defaults.ts` contains the initial primary-color preference; change it to your palette name when choosing a new brand default. Existing persisted user choices take precedence over that initial value.

Merge order is application theme → selected primary color → surface isolation defaults. Named colors resolve against the merged Mantine theme; HEX values generate a palette. The surface owns rem scale and, for shadow surfaces, the portal target, scroll locking and floating-layer defaults. Explicit component props can still override theme defaults: do not override those isolation settings in injected UI.

Direction remains an extension-wide preference exposed by `useVisual()`. It is written to each surface's own root and satellite roots, never to the host page's `<html>`. Document surfaces own their `<html>`, so writing there is intentional. Language-to-direction mapping belongs to the application.

## Externally controlled light/dark mode

The existing `extension`, `force-light`, and `force-dark` strategies remain available. A `ColorSchemeSource` can alternatively provide the surface's resolved scheme without changing the stored extension preference:

```ts
import { createColorSchemeSource } from '@/surface/color-scheme';

const scheme = createColorSchemeSource('light');
// In the existing content entrypoint's createShadowSurfaceUi options:
// colorSchemeStrategy: scheme,

// Your application updates this same source instance:
scheme.set('dark');
```

Pass the source as `colorSchemeStrategy` to `createShadowSurfaceUi` or `documentSurface`. Retain a stable source instance; update it with `set`, rather than recreating it on each render. A source can be shared intentionally or created per surface. Any external store with stable `getSnapshot(): 'light' | 'dark'` and `subscribe(listener): unsubscribe` functions can replace this helper. Functions must not require a `this` binding. Subscriptions are released when the provider unmounts or switches sources.

An external source controls the visible scheme. `useVisual().setColorScheme()` still changes the extension preference, but that preference will not override an external or forced scheme. Hide or explain the extension preference control in a surface where it does not determine the visible result.

## Follow the host page (optional accessory)

```ts
import { followHostColorScheme } from '@/surface/addons/host-scheme';

// In the existing shadow surface's options:
// colorSchemeStrategy: followHostColorScheme,
```

The core does not import this accessory. Importing it alone creates no observer or event listeners. The first subscriber starts a shared watcher; the last unsubscribe stops it and cancels scheduled work. The detector composites body/html background colors, considers the declared canvas color scheme, and follows attribute changes, OS preference changes, visibility restoration and background transitions.

This is a heuristic, not a browser-provided page-theme API. Background images, full-page child containers and theme changes made only through CSSOM or stylesheet replacement may not be detected immediately or correctly. Use your own `ColorSchemeSource` when the host exposes a reliable theme signal. This detector is intended for shadow UI on a host page, not extension-owned documents.

To verify in a real browser, enable the accessory in the existing content entrypoint and switch the host's background between light/dark, including a CSS transition and an OS-media-query theme. Check that only the extension roots change scheme and that unmounting releases listeners. Unit tests cover subscription/data flow; happy-dom does not reproduce browser paint or transitions.

## RPC clients and background implementations

The Echo example is split into `src/core/rpc/echo/contract.ts` and `impl.ts`. UI imports `getEchoService` from the contract; only the background imports `registerEchoService` from the implementation. Do not re-export the implementation through a client barrel. Type-only imports may describe services without bundling their runtime dependencies.

The existing ESLint config protects this narrow template RPC boundary. It does not prescribe the layout of application services, and its import-pattern checks are not a complete transitive dependency analysis. This boundary does not impose an application bundle-size budget.

## Separate DOM work from UI, and choose which frames need it

Each iframe has its own document and content-script context. A listener in the top document does not receive selection/input events from an iframe. Run lightweight DOM functionality in eligible frames only when the feature requires it; keep a single floating UI in the top frame.

The existing `src/entrypoints/content/index.tsx` is the UI entrypoint. Keep its default top-frame scope. If a downstream project enables all-frame injection for that entrypoint, put `if (window.self !== window.top) return;` at the start of `main` to avoid duplicate floating UI.

A separate optional `src/entrypoints/frame-events.content.ts` can start with:

```ts
import { defineContentScript } from '#imports';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  matchAboutBlank: true,
  cssInjectionMode: 'manual',
  main(ctx) {
    ctx.addEventListener(document, 'selectionchange', () => {
      // Handle this frame's selection here. No React or Mantine import needed.
    });
  },
});
```

`allFrames` still respects URL matching, permissions and browser restrictions; it does not grant access to every frame. `matchAboutBlank` is useful for eligible blank/srcdoc child frames, not a general restriction bypass. Narrow matches to your application's needs. Use extension messaging with an explicit frame target when coordinating frame-local work; do not rely on content-script load order or read another origin's DOM.

## Clean up asynchronous initialization

Use WXT's existing context lifecycle. `ctx.addEventListener` handles listener cleanup; observers and storage watchers need their own cleanup. Register invalidation handling before awaiting initialization, and check `ctx.isInvalid` after each await before mounting or starting work.

```ts
import { defineContentScript, storage } from '#imports';
import { PROJECT_PREFIX } from '@/constants';

const enabled = storage.defineItem<boolean>(`local:${PROJECT_PREFIX}:example:enabled`, {
  fallback: true,
});

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  cssInjectionMode: 'manual',
  async main(ctx) {
    let revision = 0;
    const observer = new MutationObserver(() => {
      // Handle relevant mutations in this document.
    });
    const apply = (active: boolean) => {
      if (ctx.isInvalid) return;
      observer.disconnect();
      if (active) observer.observe(document, { childList: true, subtree: true });
    };
    const unwatch = enabled.watch((value) => {
      revision++;
      apply(value);
    });
    ctx.onInvalidated(() => {
      revision++;
      unwatch();
      observer.disconnect();
    });

    const initialRevision = revision;
    try {
      const value = await enabled.getValue();
      if (ctx.isInvalid || revision !== initialRevision) return;
      apply(value);
    } catch (error) {
      if (!ctx.isInvalid) console.warn('Could not initialize example setting', error);
    }
  },
});
```

The revision check prevents an old initial read from undoing a newer watch update. For fetches, pass `ctx.signal` and handle aborts; do not treat aborting a request as proof that all async work stopped. For overlapping start/stop commands, advance a generation on both operations and verify it after awaiting. A context can still be valid while an individual operation has been superseded.

For UI creation, check invalidation after `await createShadowSurfaceUi(...)` before calling `ui.mount()`. Keep `onRemove` wired to `root.unmount()` as in the existing entrypoint, and handle rejected initialization promises in application code. WXT owns the context lifecycle; no second lifecycle framework is needed.
