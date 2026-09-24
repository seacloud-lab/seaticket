import React, { useCallback } from 'react';
import { Button } from 'reactstrap';
import { Icon, IconButton, SecondaryBtn } from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { RefreshBtn } from '@/project/components';
import TopBar from '../../top-bar';
import { KNOWLEDGE_PAGE_SLUG_ID } from '../constants';
import { useKnowledgePage } from '../hooks/knowledge-page';

import './index.css';

const KnowledgeTopBar = ({ title, permission }) => {
  const { pageSlugId, isKBRecordPreview, toggleKBRecordPreview, togglePageSlugId, onRefresh } = useKnowledgePage();

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
            className="rotate-icon-90 seaqa-project-toggle-knowledge-btn"
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
            className="rotate-icon-90 seaqa-project-toggle-knowledge-btn"
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
          className="rotate-icon-90 seaqa-project-toggle-knowledge-btn"
          onClick={() => isKBRecordPreview ? togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.ALL) : toggleKBRecordPreview(true)}
        />
        <span className="text-truncate" title={editTitle}>{editTitle}</span>
      </>
    );
  }, [pageSlugId, title, togglePageSlugId, isKBRecordPreview, toggleKBRecordPreview, onRefresh]);

  const renderRightChildren = useCallback(() => {
    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL) {
      return (
        <Button color="primary" className="btn-xs" onClick={() => togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.NEW)}>
          <Icon symbol="knowledge-base" aria-hidden="true" />
          {gettext('New record')}
        </Button>
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
  }, [pageSlugId, togglePageSlugId, permission, isKBRecordPreview, toggleKBRecordPreview]);

  return (
    <TopBar>
      {renderLeftChildren()}
      {renderRightChildren()}
    </TopBar>
  );
};

export default KnowledgeTopBar;
