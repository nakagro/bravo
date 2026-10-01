import { useEffect, useState } from "react";

export interface KeyboardInset {
  /** Pixels of the layout viewport hidden below the visible area. */
  bottom: number;
  /** Height of the visible area above the keyboard. */
  height: number;
}

// Below this the visual viewport shrank for browser chrome (URL bar), not a
// keyboard.
const KEYBOARD_THRESHOLD = 80;

/**
 * Where the on-screen keyboard sits, from the visual viewport. Null while it is
 * closed. Tracks scroll as well as resize: iOS pans the visual viewport to
 * reveal a focused field, and anything pinned to the bottom has to follow that
 * pan or it ends up behind the keyboard.
 */
export function useKeyboardInset(): KeyboardInset | null {
  const [inset, setInset] = useState<KeyboardInset | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const open = window.innerHeight - vv.height > KEYBOARD_THRESHOLD;
        setInset((prev) => {
          if (!open) return null;
          const next = {
            bottom: Math.max(0, Math.round(window.innerHeight - vv.offsetTop - vv.height)),
            height: Math.round(vv.height),
          };
          return prev && prev.bottom === next.bottom && prev.height === next.height ? prev : next;
        });
      });
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
