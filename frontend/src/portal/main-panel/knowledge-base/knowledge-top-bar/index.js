import React, { useCallback } from 'react';
import TopBar from '@/project/main-panel/top-bar';
import { useKnowledgePage } from '../hooks/knowledge-page';
import { KNOWLEDGE_PAGE_SLUG_ID } from '../constants';
import { IconButton } from '@/components';
import { gettext } from '@/constants';
import { RefreshBtn } from '@/project/components';

import './index.css';

const KnowledgeTopBar = () => {
  const { pageSlugId, togglePageSlugId, onRefresh } = useKnowledgePage();

  const renderLeftChildren = useCallback(() => {
    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL) {
      return (
        <>
          <div className="text-truncate">{gettext('Knowledge base')}</div>
          <RefreshBtn onClick={onRefresh} />
        </>
      );
    }

    const editTitle = gettext('Knowledge') + ' / #' + pageSlugId;
    return (
      <>
        <IconButton
          icon="arrow-down"
          className="rotate-icon-90 sea-qa-project-toggle-knowledge-btn"
          onClick={() => togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.ALL)}
        />
        <span className="text-truncate" title={editTitle}>{editTitle}</span>
      </>
    );
  }, [pageSlugId, togglePageSlugId]);

  return (
    <TopBar>
      {renderLeftChildren()}
    </TopBar>
  );
};

export default KnowledgeTopBar;
