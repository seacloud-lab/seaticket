import React, { useCallback, useRef, useState } from 'react';
import { IconButton, ClickOutside } from '@/components';
import { gettext } from '@/constants';
import { AI_RESOLVE_TYPE } from '../../constants';

import './index.css';

const AI_RESOLVE_TYPES = [
  { value: AI_RESOLVE_TYPE.AGENT, label: gettext('Agent') },
  { value: AI_RESOLVE_TYPE.ASK, label: gettext('Ask') },
];

const ResolveType = ({ resolveType, updateResolveType }) => {
  const [isShowMenu, setIsShowMenu] = useState(false);

  const displayValueRef = useRef(null);
  const menuTranslateY = useRef(0);

  const resetResolveType = useCallback((newResolveType) => {
    if (resolveType !== newResolveType) {
      updateResolveType(newResolveType);
    }
    setIsShowMenu(false);
  }, [resolveType, updateResolveType]);

  const onClickSessionToggle = useCallback((e) => {
    const { bottom } = displayValueRef.current.getBoundingClientRect();
    const overflowHeight = bottom + 6 + 82; // 6: margin, 82: panel height;
    menuTranslateY.current = overflowHeight > window.innerHeight ? (-(82 + 24 + 6)) : 0; // 24 is button height;
    setIsShowMenu(true);
  }, []);

  return (
    <div className="sea-qa-ai-ask-chats-resolve-type-wrapper">
      <div className="sea-qa-ai-ask-chats-resolve-type-button" ref={displayValueRef} onClick={onClickSessionToggle}>
        <span className="sea-qa-ai-ask-chats-resolve-type-button-name">{AI_RESOLVE_TYPES.find(t => t.value === resolveType)?.label}</span>
        <IconButton className="pl-1" icon="down" />
      </div>
      {isShowMenu && (
        <div className="sea-qa-ai-ask-chats-resolve-type-panel" style={{ transform: `translateY(${menuTranslateY.current}px)` }}>
          <ClickOutside onClickOutside={() => setIsShowMenu(false)}>
            <div className='sea-qa-dropdown-menu dropdown-menu position-fixed sea-metadata-view-dropdown-menu'>
              {AI_RESOLVE_TYPES.map(type => {
                const isSelected = resolveType === type.value;
                return (
                  <div onClick={() => resetResolveType(type.value)} className="dropdown-item sea-qa-dropdown-item">
                    <span>{type.label}</span>
                    {isSelected && (<IconButton icon='check'/>)}
                  </div>
                );
              })}
            </div>
          </ClickOutside>
        </div>
      )}
    </div>
  );
};

export default ResolveType;
