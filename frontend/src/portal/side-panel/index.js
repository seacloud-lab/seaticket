import React from 'react';
import { Button } from 'reactstrap';
import { gettext, siteRoot } from '@/constants';
import { CustomizeTabs } from '@/components';
import { PORTAL_PAGE, TICKETS_TAB, BASE_PRIMARY_TABS } from '../constants';
import Account from '@/components/account';
import ExternalUserAccount from '@/components/account/external-user-account';

const SidePanel = ({ activePage, onPageChange, enableKB, isAnonymous, portalName, portalLogo }) => {
  const primaryTabs = isAnonymous
    ? (enableKB
      ? [{ value: PORTAL_PAGE.CHAT, label: gettext('Chat') }, { value: PORTAL_PAGE.KNOWLEDGE_BASE, label: gettext('Knowledge base') }]
      : [{ value: PORTAL_PAGE.CHAT, label: gettext('Chat') }])
    : (enableKB
      ? [...BASE_PRIMARY_TABS, { value: PORTAL_PAGE.KNOWLEDGE_BASE, label: gettext('Knowledge base') }]
      : BASE_PRIMARY_TABS);

  const isIssuesPage = activePage === PORTAL_PAGE.SUBMIT_ISSUE || activePage === PORTAL_PAGE.MY_ISSUES;
  const activePrimaryTab = isIssuesPage ? TICKETS_TAB : activePage;

  const onPrimaryTabChange = (value) => {
    if (value === TICKETS_TAB) {
      const targetPage = isIssuesPage ? activePage : PORTAL_PAGE.SUBMIT_ISSUE;
      onPageChange(targetPage);
      return;
    }

    onPageChange(value);
  };

  const { projectUuid, isExternalUser } = window.app.pageOptions;
  const displayName = portalName || gettext('Support portal');

  return (
    <div className="sea-qa-portal-side-panel">
      <div className="sea-qa-portal-side-panel-header">
        <div className="sea-qa-portal-side-panel-logo d-flex align-items-center">
          {portalLogo ? (
            <div className="sea-qa-portal-side-panel-custom-logo">
              <img src={portalLogo} alt="" />
            </div>
          ) : (
            <div className="sea-qa-portal-side-panel-icon">
              <i className="project-icon icon-color-white icon-club-members"></i>
            </div>
          )}
          <h3>{displayName}</h3>
        </div>
        <div className="sea-qa-portal-side-panel-tabs d-flex justify-content-center flex-1">
          <CustomizeTabs
            tabs={primaryTabs}
            value={activePrimaryTab}
            onChange={onPrimaryTabChange}
          />
        </div>
        <div>
          {isAnonymous && (
            <Button
              color="outline-primary"
              onClick={() => { window.location.href = siteRoot + `portal/${projectUuid}/login/`; }}
              title={gettext('Login')}
              size="sm"
            >
              {gettext('Login')}
            </Button>
          )}
          {!isAnonymous && isExternalUser && <ExternalUserAccount />}
          {!isAnonymous && !isExternalUser && <Account />}
        </div>
      </div>
    </div>
  );
};

export default SidePanel;
