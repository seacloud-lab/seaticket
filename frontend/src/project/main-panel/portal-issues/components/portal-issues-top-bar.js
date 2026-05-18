import React, { useCallback } from 'react';
import TopBar from '../../top-bar';
import { usePortalIssuesPage, usePortalIssuesMetadata } from '../hooks';
import { PORTAL_ISSUE_PAGE_SLUG_ID } from '../constants';
import { EVENT_BUS_TYPE } from '@/project/constants/event-bus-type';
import { IconButton, IconTextBtn } from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import eventBus from '@/utils/event-bus';
import { RefreshBtn } from '@/project/components';

const PortalIssuesTopBar = ({ title, permission, type }) => {
  const { pageSlugId, togglePageSlugId, onRefresh, childrenPageSlugId } = usePortalIssuesPage();
  const { typesData, substatesData } = usePortalIssuesMetadata();

  const renderLeftChildren = useCallback(() => {
    if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.ALL) {
      return (
        <>
          <div className="text-truncate" title={title}>{title}</div>
          <RefreshBtn onClick={onRefresh} />
        </>
      );
    }

    const toggleBtn = (
      <IconButton
        icon="arrow-down"
        className="rotate-icon-90 seaqa-project-toggle-tickets-btn"
        onClick={() => togglePageSlugId(PORTAL_ISSUE_PAGE_SLUG_ID.ALL)}
      />
    );
    if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.TYPES) {
      return (
        <>
          <IconButton
            icon="arrow-down"
            className="rotate-icon-90 seaqa-project-toggle-tickets-btn"
            onClick={() => togglePageSlugId(PORTAL_ISSUE_PAGE_SLUG_ID.ALL)}
          />
          <span className="text-truncate" title={gettext('Types')}>{gettext('Types')}</span>
        </>
      );
    }
    if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.TRASH) {
      return (
        <>
          <IconButton
            icon="arrow-down"
            className="rotate-icon-90 seaqa-project-toggle-tickets-btn"
            onClick={() => togglePageSlugId(PORTAL_ISSUE_PAGE_SLUG_ID.ALL)}
          />
          <span className="text-truncate" title={gettext('Trash')}>{gettext('Trash')}</span>
        </>
      );
    }
    if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.SUBSTATES) {
      return (
        <>
          <IconButton
            icon="arrow-down"
            className="rotate-icon-90 seaqa-project-toggle-tickets-btn"
            onClick={() => togglePageSlugId(PORTAL_ISSUE_PAGE_SLUG_ID.ALL)}
          />
          <span className="text-truncate" title={gettext('Substates')}>{gettext('Substates')}</span>
        </>
      );
    }
    // Issue detail page
    const issueTitle = gettext('Issues from portal') + ' / #' + pageSlugId;
    return (
      <>
        {toggleBtn}
        <span className="text-truncate" title={issueTitle}>{issueTitle}</span>
      </>
    );
  }, [pageSlugId, childrenPageSlugId, title, typesData, substatesData, togglePageSlugId, onRefresh]);

  const renderRightChildren = useCallback(() => {
    const isRW = permission === PERMISSION_TYPES.READ_WRITE;
    if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.TYPES) {
      if (!isRW) return null;
      return (
        <IconTextBtn icon="plus" onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_TYPE)} text={gettext('New type')} />
      );
    }
    if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.SUBSTATES) {
      if (!isRW) return null;
      return (
        <IconTextBtn icon="plus" onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_SUBSTATE)} text={gettext('New substate')} />
      );
    }
    return null;
  }, [permission, pageSlugId, childrenPageSlugId]);

  return (
    <TopBar>
      {renderLeftChildren()}
      {renderRightChildren()}
    </TopBar>
  );
};

export default PortalIssuesTopBar;
