/**
 * @module surface/shadow
 *
 * SurfaceEnv factory for the in-page host surface: the extension's main UI
 * injected into arbitrary web pages, isolated in a shadow root. Encapsulates
 * every piece of wiring the isolation demands (shadow root creation via WXT,
 * root element, rem compensation, keyboard event isolation) so a content
 * script needs exactly one call.
 *
 * NOT a singleton — multiple host surfaces with arbitrary anchors are
 * supported; `name` only determines the custom element tag WXT creates.
 * Caveat: the satellite registry (surface/satellite) currently binds to ONE
 * host surface per JS context — see its module header.
 */

import { createShadowRootUi } from '#imports';
import { SURFACE_ROOT_CLASS } from '@/constants';
import type { ColorSchemeStrategy, SurfaceEnv } from './defs';
import { registerSurfaceStyles, releaseSatellites, STATIC_STYLE_ATTR } from './satellite';

type ShadowRootUiCtx = Parameters<typeof createShadowRootUi>[0];

const surfaceStylesAttached = new WeakSet<ShadowRoot>();

export interface ShadowSurfaceOptions<TMounted> {
  /** Custom element tag name (must contain a dash), e.g. SHADOW_SURFACE_TAG. */
  name: string;
  /** Bundled entrypoint CSS; avoids extension-resource requests from the host page. */
  css?: string;
  /** Where to insert the host element. Defaults to `body`. */
  anchor?: string | Element;
  /**
   * WXT positioning mode. `overlay` (default) keeps the host element at
   * zero layout footprint — in-page UI should position itself (fixed/
   * absolute), never participate in the host page's flow.
   */
  position?: 'inline' | 'overlay' | 'modal';
  colorSchemeStrategy?: ColorSchemeStrategy;
  /**
   * Keyboard events typed inside the surface must not reach host-page
   * hotkey handlers (YouTube/Twitter-style shortcuts). Defaults to
   * isolating key events; pass `false` to opt out.
   */
  isolateEvents?: boolean | string[];
  /** Mount the app into `container`; whatever it returns is passed to onRemove. */
  onMount: (container: HTMLElement, env: SurfaceEnv) => TMounted;
  onRemove?: (mounted: TMounted | undefined) => void;
}

/**
 * rem resolves against the host page's root font size even inside shadow
 * DOM. Compensate via Mantine's `theme.scale`.
 *
 * Measured with a probe element instead of reading
 * `getComputedStyle(documentElement).fontSize`: the browser's minimum-font-
 * size setting can clamp the root's COMPUTED value (e.g. report 12px on a
 * `font-size: 62.5%` page) while rem still resolves against the true 10px —
 * the probe observes what rem actually resolves to.
 */
// Internal to shadow-surface creation; not part of the public API.
function computeHostRemScale(): number {
  // document_start scripts may run before documentElement exists.
  const parent = document.documentElement ?? document.body ?? document.head;
  if (!parent) return 1;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;font-size:1rem;';
  parent.appendChild(probe);
  const remPx = Number.parseFloat(window.getComputedStyle(probe).fontSize);
  probe.remove();
  if (!Number.isFinite(remPx) || remPx <= 0) return 1;
  return 16 / remPx;
}

/**
 * Parse the static CSS once into a constructable sheet that the host surface
 * and every satellite adopt. Returns null where constructable sheets are
 * unavailable; callers then fall back to a plain <style>.
 */
function buildStaticSheet(css: string): CSSStyleSheet | null {
  if (typeof CSSStyleSheet === 'undefined' || !('replaceSync' in CSSStyleSheet.prototype)) return null;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    return sheet;
  } catch (error) {
    console.warn('[surface/shadow] constructable sheets unavailable, using <style>', error);
    return null;
  }
}

/**
 * Attach the static CSS to the host shadow root, preferring the shared sheet.
 * Adopted sheets cascade after the shadow root's <style> elements (WXT's
 * `:host` reset, Mantine's theme variables); that is safe because the reset is
 * `!important` and the static CSS is layered except for rules that never set
 * Mantine variables. Returns the sheet actually adopted, or null after
 * falling back to a <style> (e.g. Firefox content-script realm mismatches).
 */
function attachStaticStyles(shadowRoot: ShadowRoot, before: Node, css: string, sheet: CSSStyleSheet | null) {
  if (sheet) {
    try {
      shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, sheet];
      return sheet;
    } catch (error) {
      console.warn('[surface/shadow] adoptedStyleSheets unavailable, using <style>', error);
    }
  }
  const style = document.createElement('style');
  style.setAttribute(STATIC_STYLE_ATTR, '');
  style.textContent = css;
  shadowRoot.insertBefore(style, before);
  return null;
}

export async function createShadowSurfaceUi<TMounted>(ctx: ShadowRootUiCtx, options: ShadowSurfaceOptions<TMounted>) {
  const scale = computeHostRemScale();
  // WXT does not rewrite `css` it is given, and we no longer give it any:
  // the static CSS is attached in onMount as one shared sheet.
  const css = options.css?.replaceAll(':root', ':host');
  const sheet = css ? buildStaticSheet(css) : null;
  // WXT calls onMount on every mount(); remembered so a repeated mount()
  // without remove() reuses the app instead of starting a second one.
  let current: { rootElement: HTMLElement; shadowRoot: ShadowRoot; mounted: TMounted } | undefined;

  return createShadowRootUi<TMounted>(ctx, {
    name: options.name,
    position: options.position ?? 'overlay',
    anchor: options.anchor ?? 'body',
    isolateEvents: options.isolateEvents ?? ['keydown', 'keyup', 'keypress'],
    onMount: (container, shadowRoot) => {
      if (current?.rootElement.parentNode === container) return current.mounted;

      // Attached once per shadow root; a remount after remove() reuses it.
      if (css && !surfaceStylesAttached.has(shadowRoot)) {
        const adopted = attachStaticStyles(shadowRoot, container, css, sheet);
        registerSurfaceStyles(shadowRoot, { text: css, sheet: adopted });
        surfaceStylesAttached.add(shadowRoot);
      }

      // WXT 0.21 supplies a div inside the shadow root. Keep our own wrapper
      // as the Mantine theme root and portal target so all floating layers
      // stay within the surface, independently of WXT's container structure.
      const rootElement = document.createElement('div');
      rootElement.classList.add(SURFACE_ROOT_CLASS);
      container.append(rootElement);

      const env: SurfaceEnv = {
        kind: 'shadow',
        shadowRoot,
        rootElement,
        portalTarget: rootElement,
        scale,
        colorSchemeStrategy: options.colorSchemeStrategy ?? 'extension',
      };

      current = { rootElement, shadowRoot, mounted: options.onMount(rootElement, env) };
      return current.mounted;
    },
    onRemove: (mounted) => {
      // Satellites live outside the shadow host, so WXT's remove() would leave them behind.
      if (current) releaseSatellites(current.shadowRoot);
      current = undefined;
      options.onRemove?.(mounted);
    },
  });
}
