// An instant tooltip. The browser's own takes about a second to appear and
// draws in the OS's colours, which is too slow to answer "what is this icon?"
// and too foreign to sit inside a theme. This one shows on the first frame of
// hover or focus, and is positioned in fixed coordinates so it is never
// clipped by a scrolling panel or a narrow rail.

import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
