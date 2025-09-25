import React, { useCallback, useRef, useState } from 'react';
import { Icon, OptionEditor } from '@/components';
import { gettext } from '@/constants';
import { AI_RESOLVE_TYPE } from '../../constants';

import './index.css';

const AI_RESOLVE_TYPES = [
  { value: AI_RESOLVE_TYPE.AGENT, label: gettext('Agent') },
  { value: AI_RESOLVE_TYPE.ASK, label: gettext('Ask') },
];

const ResolveType = ({ resolveType, updateResolveType }) => {
  const [isShowMenu, setIsShowMenu] = useState(false);

  const ref = useRef(null);

  const resetResolveType = useCallback((newResolveType) => {
    if (resolveType !== newResolveType) {
      updateResolveType(newResolveType);
    }
    setIsShowMenu(false);
  }, [resolveType, updateResolveType]);

  const onMenuToggle = useCallback((e) => {
    setIsShowMenu(true);
  }, []);

  return (
    <>
      <div
        className="sea-qa-select custom-select sea-qa-customize-select sea-qa-ai-chat-tool-select sea-qa-ai-chat-resolve-type-select"
        ref={ref}
        onClick={onMenuToggle}
      >
        <div className="selected-option">
          <div className="selected-option-show">{AI_RESOLVE_TYPES.find(t => t.value === resolveType)?.label}</div>
          <Icon symbol="down" />
        </div>
      </div>
      {isShowMenu && (
        <OptionEditor
          className="sea-qa-ai-chat-tool-select-editor sea-qa-ai-chat-resolve-type-select-editor"
          options={AI_RESOLVE_TYPES}
          target={ref}
          isSearchEnabled={false}
          value={resolveType}
          onChange={resetResolveType}
          onToggle={() => setIsShowMenu(false)}
        />
      )}
    </>
  );
};

export default ResolveType;
