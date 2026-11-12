import { afterEach, expect, it } from 'vitest';
import { trapModalFocus } from './focus-trap';

afterEach(() => {
  document.body.replaceChildren();
});

/** A surface root inside a shadow root, holding a modal dialog and one control outside it. */
function setup() {
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const root = document.createElement('div');
  shadow.append(root);
  root.innerHTML = `
    <button id="outside">outside</button>
    <section role="dialog" aria-modal="true">
      <button id="first">first</button>
      <button disabled>disabled</button>
      <button id="last">last</button>
    </section>
    <div class="popover"><input id="pop-a"><input id="pop-b"></div>`;
  trapModalFocus(root);
  // Keyboard isolation, as the surface applies it at the shadow root.
  shadow.addEventListener('keydown', (event) => event.stopPropagation());
  const byId = (id: string) => shadow.getElementById(id) as HTMLElement;
  const tab = (shiftKey = false) => {
    const target = (shadow.activeElement as HTMLElement | null) ?? root;
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  };
  return { shadow, byId, tab };
}

it('wraps Tab from the last control to the first, inside the shadow root', () => {
  const { shadow, byId, tab } = setup();
  byId('last').focus();
  expect(tab().defaultPrevented).toBe(true);
  expect(shadow.activeElement).toBe(byId('first'));
});

it('wraps Shift+Tab from the first control to the last', () => {
  const { shadow, byId, tab } = setup();
  byId('first').focus();
  expect(tab(true).defaultPrevented).toBe(true);
  expect(shadow.activeElement).toBe(byId('last'));
});

it('pulls focus from outside the dialog back into it', () => {
  const { shadow, byId, tab } = setup();
  byId('outside').focus();
  tab();
  expect(shadow.activeElement).toBe(byId('first'));
});

it('leaves Tab between inner controls to the browser', () => {
  const { byId, tab } = setup();
  byId('first').focus();
  expect(tab().defaultPrevented).toBe(false);
});

it('does nothing without an open modal', () => {
  const { shadow, byId, tab } = setup();
  shadow.querySelector('[aria-modal]')!.remove();
  byId('outside').focus();
  expect(tab().defaultPrevented).toBe(false);
});

it('leaves Tab alone in a layer portaled after the dialog (a popover opened from it)', () => {
  const { shadow, byId, tab } = setup();
  byId('pop-a').focus();
  expect(tab().defaultPrevented).toBe(false);
  expect(shadow.activeElement).toBe(byId('pop-a'));
});
