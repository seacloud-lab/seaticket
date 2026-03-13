import React, { useCallback, useState } from 'react';
import TopBar from '../../top-bar';
import { useKnowledgePage } from '../hooks/knowledge-page';
import { KNOWLEDGE_PAGE_SLUG_ID } from '../constants';
import { IconButton, IconTextBtn, SecondaryBtn } from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { RefreshBtn } from '@/project/components';

import './index.css';

const KnowledgeTopBar = ({ title, permission }) => {
  const { pageSlugId, childrenPageSlugId, isKBRecordPreview, toggleKBRecordPreview, togglePageSlugId, onRefresh } = useKnowledgePage();

  const [isMoreMenuShow, setIsMoreMenuShow] = useState(false);
  const toggleMoreMenu = useCallback(() => setIsMoreMenuShow(prev => !prev), []);

  const renderLeftChildren = useCallback(() => {
    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL) {
      return (
        <>
          <div className="text-truncate">{title}</div>
          <RefreshBtn onClick={onRefresh} />
        </>
      );
    }

    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.NEW) {
      return (
        <>
          <IconButton
            icon="arrow-down"
            className="rotate-icon-90 sea-qa-project-toggle-knowledge-btn"
            onClick={() => togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.ALL)}
          />
          <span className="text-truncate" title={gettext('New record')}>{gettext('New record')}</span>
        </>
      );
    }

    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.TRASH) {
      return (
        <>
          <IconButton
            icon="arrow-down"
            className="rotate-icon-90 sea-qa-project-toggle-knowledge-btn"
            onClick={() => togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.ALL)}
          />
          <span className="text-truncate" title={gettext('Deleted records')}>{gettext('Deleted records')}</span>
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
          onClick={() => isKBRecordPreview ? togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.ALL) : toggleKBRecordPreview(true)}
        />
        <span className="text-truncate" title={editTitle}>{editTitle}</span>
      </>
    );
  }, [pageSlugId, title, togglePageSlugId, isKBRecordPreview, toggleKBRecordPreview]);

  const renderRightChildren = useCallback(() => {
    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL) {
      return (
        <IconTextBtn onClick={() => togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.NEW)} text={gettext('New record')} icon="knowledge-base" />
      );
    }

    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.NEW || pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.TRASH) {
      return null;
    }

    if (permission !== PERMISSION_TYPES.READ_WRITE) return null;

    if (!isKBRecordPreview) return null;

    return (
      <SecondaryBtn
        icon="revise"
        isSmall={true}
        text={gettext('Edit')}
        onClick={() => toggleKBRecordPreview(false)}
      />
    );
  }, [pageSlugId, childrenPageSlugId, togglePageSlugId, isMoreMenuShow, toggleMoreMenu, isKBRecordPreview, toggleKBRecordPreview]);

  return (
    <TopBar>
      {renderLeftChildren()}
      {renderRightChildren()}
    </TopBar>
  );
};

export default KnowledgeTopBar;
