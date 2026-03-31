import React from 'react';
import classnames from 'classnames';
import { gettext, siteRoot } from '@/constants';
import { CustomizeTabs, Icon } from '@/components';
import { PORTAL_PAGE, TICKETS_TAB, BASE_PRIMARY_TABS } from '../constants';

const SidePanel = ({ activePage, onPageChange, enableKB, isAnonymous }) => {
  const primaryTabs = isAnonymous
    ? (enableKB ? [{ value: PORTAL_PAGE.KNOWLEDGE_BASE, label: gettext('Knowledge base') }] : [])
    : (enableKB
      ? [...BASE_PRIMARY_TABS, { value: PORTAL_PAGE.KNOWLEDGE_BASE, label: gettext('Knowledge base') }]
      : BASE_PRIMARY_TABS);

  const isTicketsPage = activePage === PORTAL_PAGE.SUBMIT_TICKET || activePage === PORTAL_PAGE.MY_TICKETS;
  const activePrimaryTab = isTicketsPage ? TICKETS_TAB : activePage;

  const onPrimaryTabChange = (value) => {
    if (value === TICKETS_TAB) {
      const targetPage = isTicketsPage ? activePage : PORTAL_PAGE.SUBMIT_TICKET;
      onPageChange(targetPage);
      return;
    }

    onPageChange(value);
  };

  const { isEditMode, projectUuid, isExternalUser, username } = window.app.pageOptions;

  return (
    <div className="sea-qa-portal-side-panel">
      <div className="sea-qa-portal-side-panel-header">
        <div className="sea-qa-portal-side-panel-logo d-flex align-items-center">
          <div className="sea-qa-portal-side-panel-icon">
            <i className="project-icon icon-color-white icon-club-members"></i>
          </div>
          <h3>{gettext('Support portal')}</h3>
        </div>
        <div className="sea-qa-portal-side-panel-tabs d-flex justify-content-center flex-1">
          <CustomizeTabs
            tabs={primaryTabs}
            value={activePrimaryTab}
            onChange={onPrimaryTabChange}
          />
        </div>
        <div className="sea-qa-portal-side-panel-actions">
          {!isEditMode && isAnonymous && (
            <div
              className={classnames('sea-qa-portal-nav-item', 'sea-qa-portal-action-item')}
              onClick={() => { window.location.href = siteRoot + `portal/${projectUuid}/login/`; }}
              title={gettext('Log in')}
            >
              <Icon symbol="support-portal" className="sea-qa-portal-nav-item-icon" />
              <span className="sea-qa-portal-nav-item-name">{gettext('Log in')}</span>
            </div>
          )}
          {!isEditMode && isExternalUser && !!username && (
            <div
              className={classnames('sea-qa-portal-nav-item', 'sea-qa-portal-action-item')}
              onClick={() => { window.location.href = siteRoot + `portal-external/logout/${projectUuid}/`; }}
              title={gettext('Log out')}
            >
              <Icon symbol="logout" className="sea-qa-portal-nav-item-icon" />
              <span className="sea-qa-portal-nav-item-name">{gettext('Log out')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SidePanel;
