import { ContentScriptContext } from 'wxt/utils/content-script-context';
import { afterEach, expect, it, vi } from 'vitest';
import { SATELLITE_TAG, SURFACE_ROOT_CLASS } from '@/constants';
import { createSatellite } from './satellite';
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

async function surface(onMount = vi.fn((container: HTMLElement) => container)) {
  const ctx = new ContentScriptContext('shadow-test');
  contexts.push(ctx);
  const ui = await createShadowSurfaceUi(ctx, { name: 'aie-shadow-test', css: CSS, onMount });
  return { ui, onMount };
}

const hoisted = () => document.head.querySelectorAll('style[wxt-shadow-root-document-styles]');

it('mounts style + div directly under the shadow root with our surface root inside', async () => {
  const { ui, onMount } = await surface();
  ui.mount();

  const children = [...ui.shadow.children].map((el) => el.tagName);
  expect(children).toEqual(['STYLE', 'DIV']);
  expect(ui.shadow.querySelector('html, head, body')).toBeNull();

  const style = ui.shadow.querySelector('style')!.textContent!;
  expect(style).toContain(':host { --probe: 1px; }');
  expect(style).not.toContain(':root');
  expect(style).not.toContain('@property');

  const root = onMount.mock.calls[0]![0];
  expect(root.classList.contains(SURFACE_ROOT_CLASS)).toBe(true);
  expect(root.parentElement).toBe(ui.uiContainer);
});

it('hoists only the at-rules into one host <head> style and removes it with the UI', async () => {
  const { ui } = await surface();
  ui.mount();
  ui.mount();
  expect(hoisted()).toHaveLength(1);
  expect(hoisted()[0]!.textContent).toContain('@property --aie-tw-probe');
  expect(document.head.children).toHaveLength(1);

  ui.remove();
  expect(hoisted()).toHaveLength(0);
  expect(document.head.children).toHaveLength(0);
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
