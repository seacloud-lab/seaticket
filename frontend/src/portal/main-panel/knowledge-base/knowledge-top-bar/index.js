import React, { useCallback } from 'react';
import TopBar from '@/project/main-panel/top-bar';
import { usePortalKnowledgePage } from '../hooks/knowledge-page';
import { KNOWLEDGE_PAGE_SLUG_ID } from '../constants';
import { IconButton } from '@/components';
import { gettext } from '@/constants';
import { RefreshBtn } from '@/project/components';

import './index.css';

const PortalKnowledgeTopBar = () => {
  const { pageSlugId, togglePageSlugId, onRefresh } = usePortalKnowledgePage();

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
          className="rotate-icon-90 seaqa-portal-toggle-knowledge-btn"
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

export default PortalKnowledgeTopBar;
