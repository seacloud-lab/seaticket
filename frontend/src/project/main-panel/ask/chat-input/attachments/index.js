import React, { useCallback, useRef, useState } from 'react';
import { IconButton } from '@/components';
import { Attachments } from '../../components';

import './index.css';

const AttachmentsFormatter = ({ projectUuid, value = [], onRemove }) => {
  const validValue = Array.isArray(value) ? value.filter(Boolean) : [];
  const [scrollLeft, setScrollLeft] = useState(0);

  const ref = useRef(null);
  const attachmentsRef = useRef(null);

  const onScroll = useCallback((event) => {
    setScrollLeft(event.target.scrollLeft);
  }, []);

  const onWheel = useCallback((event) => {
    const { wheelDeltaX, wheelDeltaY } = event.nativeEvent;
    // Mouse wheel scrolls, wheelDeltaY is not 0, wheelDeltaX is 0 (scroll up and down)
    if (wheelDeltaY !== 0 && wheelDeltaX === 0) {
      let scrollLeft = ref.current.scrollLeft - wheelDeltaY;
      if (scrollLeft <= 0 && ref.current.scrollLeft > 0) {
        ref.current.scrollLeft = 0;
        return;
      }
      if (scrollLeft > 0 && scrollLeft < attachmentsRef.current.clientWidth) {
        ref.current.scrollLeft = scrollLeft;
      }
    }
  }, []);

  const onScrollControlClick = useCallback((type) => {
    const { offsetWidth, scrollWidth, scrollLeft } = ref.current;
    let targetScrollLeft;
    if (type === 'prev') {
      if (scrollLeft === 0) return;
      targetScrollLeft = Math.max(scrollLeft - 50, 0);
    }

    if (type === 'next') {
      if (scrollLeft + offsetWidth === scrollWidth) return;
      targetScrollLeft = Math.min(scrollLeft + 50, scrollLeft + offsetWidth);
    }
    ref.current.scrollLeft = targetScrollLeft;
  }, []);

  if (validValue.length === 0) return null;

  return (
    <div className="w-100 px-4 o-hidden position-relative">
      {scrollLeft > 0 && (
        <div className="sea-qa-ai-chat-attachments-scroll-before ">
          <IconButton icon="arrow-down-b" className="rotate-icon-90 no-hover-bg" onClick={() => onScrollControlClick('prev')} />
        </div>
      )}
      <div className="sea-qa-ai-chat-attachments-container" ref={ref} onScroll={onScroll} onWheel={onWheel}>
        <Attachments
          className="sea-qa-ai-chat-attachments"
          attachments={validValue}
          projectUuid={projectUuid}
          innerRef={attachmentsRef}
          onRemove={onRemove}
        />
      </div>
      {(scrollLeft + (ref.current?.offsetWidth || 0)) < attachmentsRef.current?.offsetWidth && (
        <div className="sea-qa-ai-chat-attachments-scroll-after">
          <IconButton icon="arrow-down-b" className="rotate-icon-270 no-hover-bg" onClick={() => onScrollControlClick('next')} />
        </div>
      )}
    </div>
  );
};

export default AttachmentsFormatter;
