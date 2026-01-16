import React, { useCallback } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { AI_RESOLVE_TYPE } from '../constants';

const ResolveType = ({ resolveType, updateResolveType }) => {
  const toggleResolveType = useCallback(() => {
    const newType = resolveType === AI_RESOLVE_TYPE.AGENT ? AI_RESOLVE_TYPE.ASK : AI_RESOLVE_TYPE.AGENT;
    updateResolveType(newType);
  }, [resolveType, updateResolveType]);

  return (
    <div
      className={classnames(
        'sea-qa-select custom-select sea-qa-customize-select sea-qa-ai-chat-tool-select',
        { highlighted: resolveType === AI_RESOLVE_TYPE.AGENT }
      )}
      onClick={toggleResolveType}
    >
      <div className="selected-option">
        <div className="selected-option-show">{gettext('Reasoning')}</div>
      </div>
    </div>
  );
};

export default ResolveType;
