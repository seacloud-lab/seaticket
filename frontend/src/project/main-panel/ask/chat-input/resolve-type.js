import React, { useCallback } from 'react';
import { gettext } from '@/constants';
import { AI_RESOLVE_TYPE } from '../constants';
import { SelectorDisplay } from '../components';

const ResolveType = ({ resolveType, updateResolveType }) => {
  const toggleResolveType = useCallback(() => {
    const newType = resolveType === AI_RESOLVE_TYPE.AGENT ? AI_RESOLVE_TYPE.ASK : AI_RESOLVE_TYPE.AGENT;
    updateResolveType(newType);
  }, [resolveType, updateResolveType]);

  return (
    <SelectorDisplay
      onClick={toggleResolveType}
      highlight={resolveType === AI_RESOLVE_TYPE.AGENT}
      icon="reasoning"
    >
      {gettext('Reasoning')}
    </SelectorDisplay>
  );
};

export default ResolveType;
