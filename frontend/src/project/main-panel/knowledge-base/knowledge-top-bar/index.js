import React, { useCallback } from 'react';
import TopBar from '../../top-bar';
import { useKnowledgePage } from '../hooks/knowledge-page';
import { KNOWLEDGE_PAGE_SLUG_ID } from '../constants';
import { IconButton } from '@/components';
import { gettext } from '@/constants';
import AddButton from '@/project/components/add-button';

import './index.css';

const KnowledgeTopBar = ({ title }) => {
  const { pageSlugId, togglePageSlugId } = useKnowledgePage();

  const renderLeftChildren = useCallback(() => {
    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL) {
      return (
        <>
          <div className="text-truncate">{title}</div>
        </>
      );
    }

    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.NEW) {
      return (
        <>
          <IconButton
            icon="down"
            className="rotate-icon-90 sea-qa-project-toggle-knowledge-btn"
            onClick={() => togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.ALL)}
          />
          <span className="text-truncate" title={gettext('Add knowledge record')}>{gettext('Add knowledge record')}</span>
        </>
      );
    }
    return null;
  }, [pageSlugId, title, togglePageSlugId]);

  const renderRightChildren = useCallback(() => {
    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL) {
      return (
        <AddButton onClick={() => togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.NEW)} text={gettext('Add record')} icon="add" />
      );
    }
    return null;
  }, [pageSlugId, togglePageSlugId]);

  return (
    <TopBar>
      {renderLeftChildren()}
      {renderRightChildren()}
    </TopBar>
  );
};

export default KnowledgeTopBar;
