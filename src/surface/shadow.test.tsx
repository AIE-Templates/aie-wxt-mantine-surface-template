import { ContentScriptContext } from 'wxt/utils/content-script-context';
import { MantineProvider } from '@mantine/core';
import { render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SATELLITE_TAG, SURFACE_ROOT_CLASS } from '@/constants';
import { SurfaceProvider } from './context';
import type { SurfaceEnv } from './defs';
import { createSatellite, SatelliteOutlet } from './satellite';
import { createShadowSurfaceUi } from './shadow';

/**
 * Pins the shadow structure WXT 0.21 / @webext-core/isolated-element 3 produce
 * (style + div directly under the shadow root, no nested html/head/body) and
 * the surface lifecycle built on it. A dependency bump that changes either
 * fails here instead of silently shifting which selectors match.
 */

const CSS = ':root { --probe: 1px; } @property --aie-tw-probe { syntax: "*"; inherits: false; }';
const contexts: ContentScriptContext[] = [];

afterEach(() => {
  contexts.splice(0).forEach((ctx) => ctx.abort());
  document.head.replaceChildren();
  document.body.replaceChildren();
});

type MountFn = (container: HTMLElement, env: SurfaceEnv) => HTMLElement;

async function surface<T extends MountFn = ReturnType<typeof vi.fn<MountFn>>>(
  onMount: T = vi.fn<MountFn>((container) => container) as unknown as T
) {
  const ctx = new ContentScriptContext('shadow-test');
  contexts.push(ctx);
  const ui = await createShadowSurfaceUi(ctx, { name: 'aie-shadow-test', css: CSS, onMount });
  return { ui, onMount };
}

const hoisted = () => document.head.querySelectorAll('style[wxt-shadow-root-document-styles]');

const staticText = (sheet: CSSStyleSheet) => [...sheet.cssRules].map((rule) => rule.cssText).join('\n');

it('mounts style + div directly under the shadow root and adopts the static CSS as one sheet', async () => {
  const { ui, onMount } = await surface();
  ui.mount();

  const children = [...ui.shadow.children].map((el) => el.tagName);
  expect(children).toEqual(['STYLE', 'DIV']);
  expect(ui.shadow.querySelector('html, head, body')).toBeNull();

  // WXT's own <style> keeps only its :host reset; the static CSS is adopted.
  const wxtStyle = ui.shadow.querySelector('style')!.textContent!;
  expect(wxtStyle).toContain('all:initial');
  expect(wxtStyle).not.toContain('--probe');
  expect(ui.shadow.adoptedStyleSheets).toHaveLength(1);
  expect(staticText(ui.shadow.adoptedStyleSheets[0]!)).toContain('--probe');
  expect(staticText(ui.shadow.adoptedStyleSheets[0]!)).not.toContain(':root');

  const root = onMount.mock.calls[0]![0];
  expect(root.classList.contains(SURFACE_ROOT_CLASS)).toBe(true);
  expect(root.parentElement).toBe(ui.uiContainer);

  ui.remove();
  ui.mount();
  expect(ui.shadow.adoptedStyleSheets).toHaveLength(1);
});

it('adds nothing to the host <head>', async () => {
  const { ui } = await surface();
  ui.mount();
  expect(hoisted()).toHaveLength(0);
  expect(document.head.children).toHaveLength(0);
  ui.remove();
  expect(document.head.children).toHaveLength(0);
});

it('falls back to a <style> when the sheet cannot be adopted', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'adoptedStyleSheets')!;
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
    ...descriptor,
    set() {
      throw new TypeError('realm mismatch');
    },
  });
  try {
    const { ui } = await surface();
    ui.mount();
    const styles = [...ui.shadow.querySelectorAll('style')];
    expect(styles).toHaveLength(2);
    expect(styles[1]!.textContent).toContain(':host { --probe: 1px; }');
    expect(styles[1]!.nextElementSibling).toBe(ui.uiContainer);
  } finally {
    Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', descriptor);
    warn.mockRestore();
  }
});

it('shares the host surface sheet object with satellites across theme changes', async () => {
  let env: SurfaceEnv | undefined;
  const { ui } = await surface(
    vi.fn((container: HTMLElement, surfaceEnv: SurfaceEnv) => {
      env = surfaceEnv;
      return container;
    })
  );
  ui.mount();
  const anchor = document.createElement('p');
  document.body.append(anchor);
  const first = createSatellite(anchor, null);
  const second = createSatellite(anchor, null, { position: 'beforebegin' });
  const tree = (primaryColor: string) => (
    <SurfaceProvider env={env!}>
      <MantineProvider theme={{ primaryColor }} cssVariablesSelector={`.${SURFACE_ROOT_CLASS}`}>
        <SatelliteOutlet />
      </MantineProvider>
    </SurfaceProvider>
  );
  const view = render(tree('blue'), { container: env!.rootElement });
  const sheetsOf = (handle: typeof first) => handle.hostElement.shadowRoot!.adoptedStyleSheets;
  const hostSheet = ui.shadow.adoptedStyleSheets[0]!;
  const before = [...sheetsOf(first)];
  // Same cascade order as the host: its <style>s first, the adopted static sheet last.
  expect(before.at(-1)).toBe(hostSheet);
  expect(before.indexOf(hostSheet)).toBe(before.length - 1);
  expect([...sheetsOf(second)]).toEqual(before);
  // WXT's :host reset is captured too, so satellite hosts are reset as well.
  const reset = before.find((sheet) => /all:\s*initial/.test(staticText(sheet)));
  expect(reset).toBeDefined();

  view.rerender(tree('red'));
  await waitFor(() => expect([...sheetsOf(first)]).not.toEqual(before));
  // Only the changed theme-variables style was re-parsed; the rest are the same objects.
  expect(sheetsOf(first).at(-1)).toBe(hostSheet);
  expect(sheetsOf(first)).toContain(reset);
  expect([...sheetsOf(second)]).toEqual([...sheetsOf(first)]);
  view.unmount();
});

it('reuses the app when mount() is called again without remove()', async () => {
  const { ui, onMount } = await surface();
  ui.mount();
  ui.mount();
  expect(onMount).toHaveBeenCalledTimes(1);
  expect(ui.uiContainer.querySelectorAll(`.${SURFACE_ROOT_CLASS}`)).toHaveLength(1);

  ui.remove();
  ui.mount();
  expect(onMount).toHaveBeenCalledTimes(2);
  expect(ui.uiContainer.querySelectorAll(`.${SURFACE_ROOT_CLASS}`)).toHaveLength(1);
});

it('tears satellites down with the surface', async () => {
  const { ui } = await surface();
  ui.mount();
  const anchor = document.createElement('p');
  document.body.append(anchor);
  const satellite = createSatellite(anchor, null);
  expect(document.querySelectorAll(SATELLITE_TAG)).toHaveLength(1);

  ui.remove();
  expect(document.querySelectorAll(SATELLITE_TAG)).toHaveLength(0);
  expect(() => satellite.destroy()).not.toThrow();
});
