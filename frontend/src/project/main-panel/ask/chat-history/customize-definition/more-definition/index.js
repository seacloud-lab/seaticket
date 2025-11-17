
import React, { useCallback, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { getConnectionIcon } from '@/project/main-panel/connections/utils';
import { gettext } from '@/constants';
import { CustomizePopover, IconButton } from '@/components';
import Definition from '../definition';

import './index.css';

const initDefinitionIndex = 3;

const MoreDefinition = ({ element, attributes, editor, sources, settings, onClick, openDefinitionRecord }) => {
  const [isShowMore, setIsShowMore] = useState(false);
  const [definitionIndex, setDefinitionIndex] = useState(initDefinitionIndex);

  const moreRef = useRef();

  const icons = useMemo(() => {
    return sources.slice(2).map(s => getConnectionIcon(s.type));
  }, [sources]);
  const sourcesCount = useMemo(() => sources.length, [sources]);

  const openShowMore = useCallback(() => {
    setIsShowMore(true);
  }, []);

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
        className={classnames('sea-ai-chat-customize-definition')}
        onClick={openShowMore}
        ref={moreRef}
      >
        <div className="sea-ai-chat-customize-definition-simple-info">
          <div className="sea-ai-chat-customize-definition-title-score">
            <div className="sea-ai-chat-customize-definition-title text-truncate">{gettext('See context')}</div>
          </div>
          <div className="sea-ai-chat-customize-definition-avatars">
            {icons.map((icon, index) => (<img src={icon} key={index} alt='' />))}
          </div>
        </div>
        <div className="sea-ai-chat-customize-definition-content">
          {gettext('See more')}
        </div>
      </div>
      {isShowMore && (
        <CustomizePopover
          target={moreRef}
          className="sea-ai-chat-customize-definitions-popover"
          hidePopover={hideShowMore}
          hidePopoverWithEsc={hideShowMore}
        >
          <div className="sea-ai-chat-customize-definitions-container" style={{ width: moreRef.current?.getBoundingClientRect()?.width }}>
            <div className="sea-ai-chat-customize-definitions-title">
              <IconButton icon="left" className="sea-ai-chat-customize-definitions-index-btn" onClick={() => moveDefinitionIndex(-1)} />
              <div className="sea-ai-chat-customize-definitions-index">{`${definitionIndex} / ${sourcesCount}`}</div>
              <IconButton icon="right" className="sea-ai-chat-customize-definitions-index-btn" onClick={() => moveDefinitionIndex(1)} />
            </div>
            <Definition
              element={{ id: definitionIndex, identifier: definitionIndex }}
              editor={editor}
              sources={sources}
              settings={settings}
              onClick={handleClick}
              openDefinitionRecord={handleOpenDefinitionRecord}
            />
          </div>
        </CustomizePopover>
      )}
    </>
  );
};

export default MoreDefinition;
