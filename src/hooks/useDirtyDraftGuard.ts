import { useCallback, useEffect, useRef, useState } from "react";

interface DirtyDraftGuard {
  /** True while the discard prompt is on screen. */
  promptOpen: boolean;
  /** Pass to the confirmation dialog's `onOpenChange`. */
  setPromptOpen: (open: boolean) => void;
  /** Discard the draft and let the pending exit through. */
  confirmDiscard: () => void;
  /** Keep the draft; the prompt closes and nothing else happens. */
  cancelDiscard: () => void;
  /**
   * Pass to `ResponsiveModal`'s `onRequestClose` and use for Cancel. Returns
   * false and raises the prompt while the draft is dirty, so the close button,
   * Cancel, Escape, an outside tap and the drawer swipe all route through one
   * confirmation.
   */
  requestClose: () => boolean;
  /** Call after a successful save, before navigating away deliberately. */
  release: () => void;
}

/**
 * One guard for every exit from a dirty editor.
 *
 * Back is caught with a `popstate` trap rather than React Router's
 * `useBlocker`, which needs a data router; this app mounts `BrowserRouter`.
 * The trap covers the browser and Android Back buttons; in-app links elsewhere
 * on the page are not intercepted, which is fine because the editor is a modal
 * and the only links reachable while it is open are its own.
 *
 * Deliberately no `beforeunload`: a refresh losing one unsaved edit is not
 * worth a browser-level warning on every tab close.
 */
export function useDirtyDraftGuard(isDirty: boolean, onDiscard: () => void): DirtyDraftGuard {
  const [promptOpen, setPromptOpen] = useState(false);
  const [released, setReleased] = useState(false);
  const discardRef = useRef(onDiscard);
  discardRef.current = onDiscard;

  const active = isDirty && !released;

  useEffect(() => {
    if (!active) return;

    // A sentinel entry so the first Back lands here instead of leaving the
    // editor. Undoing it on cleanup keeps the history stack the size it was.
    const href = window.location.href;
    window.history.pushState({ draftGuard: true }, "", href);

    const onPopState = () => {
      window.history.pushState({ draftGuard: true }, "", href);
      setPromptOpen(true);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (window.history.state?.draftGuard) window.history.back();
    };
  }, [active]);

  const requestClose = useCallback(() => {
    if (!active) return true;
    setPromptOpen(true);
    return false;
  }, [active]);

  const confirmDiscard = useCallback(() => {
    setPromptOpen(false);
    setReleased(true);
    discardRef.current();
  }, []);

  const cancelDiscard = useCallback(() => setPromptOpen(false), []);

  const release = useCallback(() => setReleased(true), []);

  return {
    promptOpen,
    setPromptOpen: (open: boolean) => (open ? setPromptOpen(true) : cancelDiscard()),
    confirmDiscard,
    cancelDiscard,
    requestClose,
    release,
  };
}
