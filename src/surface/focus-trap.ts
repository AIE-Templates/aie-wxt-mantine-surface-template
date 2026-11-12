/**
 * @module surface/focus-trap
 *
 * Keeps Mantine's own focus handling working behind keyboard isolation.
 *
 * Mantine's `useFocusTrap` (Modal, Drawer, trapFocus Popover/Menu, FocusTrap)
 * and `useFocusReturn` listen for `keydown` on `document`. Keys typed in a
 * shadow surface or a satellite never get there: isolation stops them at the
 * shadow root so host-page hotkeys stay quiet.
 *
 * Rather than re-implement the trap (which components trap, when, and how Tab
 * wraps are private to Mantine and carry no DOM marker), the Tab keydown is
 * handed to the very listeners Mantine registered:
 *
 * - `document.addEventListener` / `removeEventListener` are wrapped on the
 *   `document` object of THIS JS context (the content script's isolated
 *   world; the host page's own `document` wrapper and listeners are
 *   untouched). Bubble-phase `keydown` registrations are mirrored onto a
 *   private, detached element, so order, `once`, `signal` and removal follow the
 *   browser's own bookkeeping.
 * - At an isolating shadow root, a copy of each Tab keydown is dispatched on
 *   that private target, and `preventDefault()` is carried back to the real
 *   event.
 *
 * So exactly the traps Mantine considers active run, with Mantine's
 * algorithm, in Mantine's order - and the host page still sees nothing.
 *
 * Limits: only Tab is relayed (other keys stay fully isolated); listeners get
 * a copy whose `target` is the private element and `isTrusted` is false;
 * capture-phase document listeners are not mirrored (they already run before
 * the event enters the shadow tree).
 */

type Listener = EventListenerOrEventListenerObject;
type Options = boolean | AddEventListenerOptions | undefined;

let mirror: EventTarget | undefined;

const isCapture = (options: Options) => (typeof options === 'object' ? !!options.capture : !!options);

function mirrorDocumentKeydown(): EventTarget {
  if (mirror) return mirror;
  // A detached element, not `new EventTarget()`: in a Firefox content script
  // listeners on a bare EventTarget are never called (verified in Firefox 157).
  const target = (mirror = document.createElement('div'));
  const add = document.addEventListener.bind(document);
  const remove = document.removeEventListener.bind(document);
  document.addEventListener = (type: string, listener: Listener, options?: Options) => {
    add(type, listener, options);
    if (type === 'keydown' && !isCapture(options)) target.addEventListener(type, listener, options);
  };
  document.removeEventListener = (type: string, listener: Listener, options?: Options) => {
    remove(type, listener, options);
    if (type === 'keydown' && !isCapture(options)) target.removeEventListener(type, listener, options);
  };
  return target;
}

const relayed = new WeakSet<ShadowRoot>();

/**
 * Deliver Tab keydowns that reach `shadowRoot` to this context's document
 * keydown listeners. Call it for shadow roots that stop `keydown` from
 * propagating, before the UI inside mounts (listeners registered before the
 * first call are not known). Idempotent per shadow root.
 */
export function relayTabKeydown(shadowRoot: ShadowRoot): void {
  const target = mirrorDocumentKeydown();
  if (relayed.has(shadowRoot)) return;
  relayed.add(shadowRoot);
  shadowRoot.addEventListener('keydown', (event) => {
    const { key, code, shiftKey, ctrlKey, altKey, metaKey, repeat } = event as KeyboardEvent;
    if (key !== 'Tab') return;
    const init = { key, code, shiftKey, ctrlKey, altKey, metaKey, repeat, cancelable: true };
    const copy = new KeyboardEvent('keydown', init);
    target.dispatchEvent(copy);
    if (copy.defaultPrevented) event.preventDefault();
  });
}
