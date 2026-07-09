import React, { useEffect, useState, useRef } from 'react';
import { Button } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { CustomizeTabs, IconButton } from '@/components';
import { PORTAL_PAGE, TICKETS_TAB, BASE_PRIMARY_TABS } from '../constants';
import Account from '@/components/account';
import ExternalUserAccount from '@/components/account/external-user-account';
import { usePortalSettings } from '../hooks';
import { isMobile } from '@/utils/utils';
import { getPortalLoginPath } from '../path-utils';

const SidePanel = ({ isEditMode, activePage, onPageChange, enableKB, isAnonymous }) => {
  const { logo, name } = usePortalSettings();
  const [isShowMobileMenu, setIsShowMobileMenu] = useState(false);
  const sideRef = useRef(null);

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

    if (isShowMobileMenu) {
      setIsShowMobileMenu(false);
    }
  };

  useEffect(() => {
    if (!isMobile) {
      return;
    }
    const handleClickOutside = (event) => {
      if (sideRef.current.contains(event.target)) return;
      setIsShowMobileMenu(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const { isExternalUser, isPortalDomain } = window.app.pageOptions;

  return (
    <>
      <div className="seaqa-portal-side-panel" ref={sideRef}>
        <div className="seaqa-portal-side-panel-header">
          <div className="seaqa-portal-side-panel-logo d-flex align-items-center">
            <img src={logo} alt="" />
            <h3 className="text-truncate" title={name}>{name}</h3>
          </div>
          <div className="seaqa-portal-side-panel-tabs d-flex justify-content-center flex-1">
            <CustomizeTabs
              tabs={primaryTabs}
              value={activePrimaryTab}
              onChange={onPrimaryTabChange}
            />
          </div>
          <div className="seaqa-portal-side-panel-account">
            {/* Mobile menu toggle button */}
            <IconButton
              icon={isShowMobileMenu ? 'close' : 'menu'}
              onClick={(e) => {e.stopPropagation(); setIsShowMobileMenu(!isShowMobileMenu); }}
              className="seaqa-portal-mobile-side-panel-more-btn no-hover-bg"
              size={{ btn: 32, icon: 16 }}
            />
            {isAnonymous && (
              <Button
                color="outline-primary"
                onClick={() => { window.location.href = getPortalLoginPath(); }}
                title={gettext('Login')}
                size="sm"
              >
                {gettext('Login')}
              </Button>
            )}
            {!isAnonymous && (isExternalUser || isPortalDomain) && <ExternalUserAccount />}
            {!isAnonymous && !isExternalUser && !isPortalDomain && <Account />}
          </div>
        </div>
        {isShowMobileMenu && (
          <div className="seaqa-portal-side-panel-mobile-menu">
            {primaryTabs.map((tab) => (
              <div
                className={classnames('seaqa-portal-side-panel-mobile-menu-item', { 'active': tab.value === activePrimaryTab })}
                key={tab.value}
                onClick={() => onPrimaryTabChange(tab.value)}
              >
                {tab.label}
              </div>
            ))}
          </div>
        )}
      </div>
      {isShowMobileMenu && <div className={classnames('modal-backdrop fade show', { 'edit-mode': isEditMode })}></div>}
    </>
  );
};

export default SidePanel;
