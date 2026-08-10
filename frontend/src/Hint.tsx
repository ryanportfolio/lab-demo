// An instant tooltip. The browser's own takes about a second to appear and
// draws in the OS's colours, which is too slow to answer "what is this icon?"
// and too foreign to sit inside a theme. This one shows on the first frame of
// hover or focus, and is positioned in fixed coordinates so it is never
// clipped by a scrolling panel or a narrow rail.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** how close the bubble may come to the window's edge */
const MARGIN = 8;

export default function Hint({
  text,
  placement = 'bottom',
  children,
}: {
  text: string;
  /** which side of the trigger the bubble sits on */
  placement?: 'bottom' | 'right';
  children: ReactNode;
}) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const host = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);

  const show = () => {
    const trigger = host.current?.firstElementChild ?? host.current;
    if (!trigger) return;
    const box = trigger.getBoundingClientRect();
    setAt(
      placement === 'right'
        ? { x: box.right + 8, y: box.top + box.height / 2 }
        : { x: box.left + box.width / 2, y: box.bottom + 7 },
    );
  };
  const hide = () => setAt(null);

  // The controls that need naming sit in corners, so a bubble centred on one
  // runs off the window and is cut. It is measured and pulled back inside
  // before it paints.
  useLayoutEffect(() => {
    const el = bubble.current;
    if (!el || !at) return;
    el.style.transform = 'none';
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const wanted = placement === 'right' ? at.x : at.x - width / 2;
    const maxLeft = Math.max(MARGIN, window.innerWidth - width - MARGIN);
    el.style.left = `${Math.min(Math.max(wanted, MARGIN), maxLeft)}px`;
    const wantedTop = placement === 'right' ? at.y - height / 2 : at.y;
    const maxTop = Math.max(MARGIN, window.innerHeight - height - MARGIN);
    el.style.top = `${Math.min(Math.max(wantedTop, MARGIN), maxTop)}px`;
  }, [at, placement, text]);

  return (
    <>
      <span
        className="hint-host"
        ref={host}
        onPointerEnter={show}
        onPointerLeave={hide}
        onPointerDown={hide}
        onFocusCapture={show}
        onBlurCapture={hide}
      >
        {children}
      </span>
      {at &&
        createPortal(
          <span
            className="hint"
            ref={bubble}
            data-placement={placement}
            role="tooltip"
            style={{ left: at.x, top: at.y }}
          >
            {text}
          </span>,
          document.body,
        )}
    </>
  );
}
