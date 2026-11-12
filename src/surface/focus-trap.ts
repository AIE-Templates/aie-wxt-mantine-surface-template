/**
 * @module surface/focus-trap
 *
 * Tab cycling for modal dialogs inside a shadow surface. Mantine's
 * useFocusTrap listens for `keydown` on `document`, which never sees keys
 * typed in the surface: keyboard isolation stops them at the shadow root so
 * host-page hotkeys stay quiet. This listener runs inside the shadow tree,
 * before that boundary, and keeps Tab / Shift+Tab within the topmost open
 * `[aria-modal="true"]` element (Mantine Modal and Drawer content).
 */

const TABBABLE = 'a[href], button, input, select, textarea, [tabindex]';

const visible = (element: Element) => element.checkVisibility?.() ?? true;

function tabbables(container: Element): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(':disabled') &&
      !(element instanceof HTMLInputElement && element.type === 'hidden') &&
      visible(element)
  );
}

export function trapModalFocus(root: HTMLElement): void {
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || event.defaultPrevented) return;
    const dialog = [...root.querySelectorAll<HTMLElement>('[aria-modal="true"]')].filter(visible).at(-1);
    if (!dialog) return;
    const items = tabbables(dialog);
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const active = (root.getRootNode() as Document | ShadowRoot).activeElement;
    const inside = active !== null && dialog.contains(active);
    if (!inside || (event.shiftKey && (active === first || active === dialog))) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
