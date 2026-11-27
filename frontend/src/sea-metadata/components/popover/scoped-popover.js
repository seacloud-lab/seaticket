import React, { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import CustomizePopover from '@/components/customize-popover';
import { useSeaMetadataContext } from '../../context-provider';

export const hasScopedSelector = (context, selector) => {
  const doc = context.root?.ownerDocument;
  return Boolean(doc && Array.from(doc.querySelectorAll(selector)).some(element => {
    // Reactstrap puts the popover class on a wrapper outside our scope marker.
    const content = element.querySelector('[data-sea-metadata-instance]') || element;
    return context.ownsEvent({ target: content });
  }));
};

export const isPopoverKeyEvent = (event, popover) => {
  const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
  const source = target?.closest('[data-sea-metadata-popover]');
  return !event.defaultPrevented && (!source || source === popover);
};

export const ScopedPopoverContent = forwardRef(({ children, target, ...props }, ref) => {
  const context = useSeaMetadataContext();
  const [popover, setPopover] = useState(null);
  useImperativeHandle(ref, () => popover, [popover]);
  useLayoutEffect(() => {
    if (!popover) return;
    const doc = popover.ownerDocument;
    const previousFocus = doc.activeElement;
    const trigger = typeof target === 'string' ? doc.getElementById(target) : typeof target === 'function' ? target() : target?.current || target;
    if (!popover.contains(previousFocus)) popover.focus({ preventScroll: true });
    return () => {
      // Closing a popover must not steal focus from another table or dialog.
      if (popover.contains(doc.activeElement) || doc.activeElement === doc.body) {
        const restore = trigger?.closest?.('input, button, select, textarea, a[href], [tabindex]') || previousFocus;
        if (restore?.isConnected) restore.focus?.({ preventScroll: true });
      }
    };
  }, [popover, target]);

  const keepFocus = useCallback(() => {
    const doc = popover?.ownerDocument;
    if (doc && (doc.activeElement === doc.body || doc.activeElement === doc.documentElement)) {
      popover.focus({ preventScroll: true });
    }
  }, [popover]);

  return (
    <div {...props} ref={setPopover} data-sea-metadata-instance={context.id} data-sea-metadata-popover="" tabIndex={-1} onClickCapture={keepFocus}>{children}</div>
  );
});

const ScopedPopover = ({ children, target, ...props }) => {
  const context = useSeaMetadataContext();
  const popoverRef = useRef(null);
  const shouldHandleEvent = useCallback((event) => {
    if (event.type === 'keydown' && !isPopoverKeyEvent(event, popoverRef.current)) return false;
    return context.ownsEvent(event, { allowOutside: event.type === 'mousedown' });
  }, [context]);
  return (
    <CustomizePopover {...props} target={target} shouldHandleEvent={shouldHandleEvent}>
      <ScopedPopoverContent ref={popoverRef} target={target}>{children}</ScopedPopoverContent>
    </CustomizePopover>
  );
};

export default ScopedPopover;
