
import React, { useCallback, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { CustomizePopover, IconButton } from '@/components';
import Definition from '../definition';

import './index.css';

const initDefinitionIndex = 4;

const MoreDefinition = ({ element, attributes, editor, sources, settings, onClick, openDefinitionRecord }) => {
  const [isShowMore, setIsShowMore] = useState(false);
  const [definitionIndex, setDefinitionIndex] = useState(initDefinitionIndex);
  const [popoverWidth, setPopoverWidth] = useState(0);

  const moreRef = useRef();

  const count = useMemo(() => {
    return Math.max(0, sources.length - 3);
  }, [sources]);
  const sourcesCount = useMemo(() => sources.length, [sources]);

  const openShowMore = useCallback(() => {
    const siblingWidth = moreRef.current?.previousElementSibling?.getBoundingClientRect()?.width;
    const width = Number.isFinite(siblingWidth) ? `${siblingWidth}px` : undefined;
    setPopoverWidth(width);
    setIsShowMore(true);
  }, [moreRef]);

  const hideShowMore = useCallback(() => {
    setIsShowMore(false);
    setDefinitionIndex(initDefinitionIndex);
  }, []);

  const moveDefinitionIndex = useCallback((step) => {
    let nextDefinitionIndex = definitionIndex + step;
    if (initDefinitionIndex <= nextDefinitionIndex && nextDefinitionIndex <= sourcesCount) {
      setDefinitionIndex(nextDefinitionIndex);
      return;
    }
    if (nextDefinitionIndex < initDefinitionIndex) {
      nextDefinitionIndex = sourcesCount;
    }

    if (nextDefinitionIndex > sourcesCount) {
      nextDefinitionIndex = initDefinitionIndex;
    }
    setDefinitionIndex(nextDefinitionIndex);
  }, [definitionIndex, sourcesCount]);

  const handleClick = useCallback((event) => {
    setIsShowMore(false);
    onClick && onClick(event);
  }, [onClick]);

  const handleOpenDefinitionRecord = useCallback((event, record) => {
    setIsShowMore(false);
    openDefinitionRecord && openDefinitionRecord(event, record);
  }, [openDefinitionRecord]);

  return (
    <>
      <div
        className={classnames('seaqa-ai-chat-customize-definition seaqa-ai-chat-customize-more-definition')}
        onClick={openShowMore}
        ref={moreRef}
      >
        <span className="more-definition-content">
          +{count}
        </span>
      </div>
      {isShowMore && (
        <CustomizePopover
          target={moreRef}
          className="seaqa-ai-chat-customize-definitions-popover"
          placement="bottom-end"
          hidePopover={hideShowMore}
          hidePopoverWithEsc={hideShowMore}
        >
          <div className="seaqa-ai-chat-customize-definitions-container" style={{ width: popoverWidth }}>
            <div className="seaqa-ai-chat-customize-definitions-title">
              <IconButton icon="arrow-left" className="seaqa-ai-chat-customize-definitions-index-btn" onClick={() => moveDefinitionIndex(-1)} />
              <div className="seaqa-ai-chat-customize-definitions-index">
                <span>{definitionIndex}</span>
                <span className="sources-count-text">/{sourcesCount}</span>
              </div>
              <IconButton icon="arrow-right" className="seaqa-ai-chat-customize-definitions-index-btn" onClick={() => moveDefinitionIndex(1)} />
            </div>
            <Definition
              element={{ id: definitionIndex, identifier: definitionIndex }}
              editor={editor}
              sources={sources}
              settings={settings}
              onClick={handleClick}
              openDefinitionRecord={handleOpenDefinitionRecord}
              disableAutoWidth={true}
            />
          </div>
        </CustomizePopover>
      )}
    </>
  );
};

export default MoreDefinition;
