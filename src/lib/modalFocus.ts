import { useEffect, useRef, type RefObject } from 'react';

/**
 * Where a Tab press should send focus inside a modal, or null to let the browser move it normally.
 * `active` is the index of the focused item among `count` focusable items, or -1 when focus is outside them.
 */
export function trapTarget(count: number, active: number, shift: boolean): number | null {
  if (count <= 0) return null;
  if (active < 0) return shift ? count - 1 : 0;
  if (shift && active === 0) return count - 1;
  if (!shift && active === count - 1) return 0;
  return null;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const focusables = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);

/**
 * Keyboard behaviour every modal needs: focus moves into it on open, Tab stays inside it, Escape closes it
 * (when `onClose` is given), and focus returns to whatever opened it. Put `ref` on the dialog's outer element.
 * Mark the element that should receive focus first with `data-autofocus`; otherwise the first control that is
 * not a Close button gets it. `active` is for modals that stay mounted while hidden.
 */
export function useModalA11y(ref: RefObject<HTMLElement | null>, onClose?: () => void, active = true): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement as HTMLElement | null;
    const root = ref.current;
    if (root && !root.contains(document.activeElement)) {
      const items = focusables(root);
      const first =
        root.querySelector<HTMLElement>('[data-autofocus]') ??
        items.find((el) => el.getAttribute('aria-label') !== 'Close') ??
        items[0];
      first?.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      const node = ref.current;
      if (!node) return;
      if (e.key === 'Escape' && closeRef.current) {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables(node);
      const target = trapTarget(items.length, items.indexOf(document.activeElement as HTMLElement), e.shiftKey);
      if (target !== null) {
        e.preventDefault();
        items[target].focus();
      } else if (items.length === 0) {
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // If the opener is gone (e.g. a menu item that closed), fall back to the element marked data-modal-return.
      const back = opener && opener !== document.body && opener.isConnected ? opener :document.querySelector<HTMLElement>('[data-modal-return]');
      back?.focus();
    };
  }, [active, ref]);
}
