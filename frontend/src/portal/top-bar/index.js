import React, { useEffect, useState, useRef } from 'react';
import { Button } from 'reactstrap';
import classnames from 'classnames';
import { CustomizeTabs, IconButton } from '@/components';
import Account from '@/components/account';
import ExternalUserAccount from '@/components/account/external-user-account';
import { gettext } from '@/constants';
import { PORTAL_DEFAULT_SETTINGS } from '@/project/constants';
import { isMobile } from '@/utils/utils';
import { PORTAL_PAGE, TICKETS_TAB, getPrimaryTabs } from '../constants';
import { getPortalLoginPath } from '../path-utils';
import LanguageSelector from './language-selector';

import './index.css';

const { isExternalUser, isPortalDomain, portalLogo, portalName } = window.app.pageOptions;
const logo = portalLogo || PORTAL_DEFAULT_SETTINGS.portal_logo;
const name = portalName || PORTAL_DEFAULT_SETTINGS.portal_name;

const TopBar = ({ isEditMode, activePage, onPageChange, isAnonymous, canAccessIssues }) => {
  const [isShowMobileMenu, setIsShowMobileMenu] = useState(false);
  const topBarRef = useRef(null);
  const primaryTabs = getPrimaryTabs({ isAnonymous, canAccessIssues });

  const isIssuesPage = [PORTAL_PAGE.SUBMIT_ISSUE, PORTAL_PAGE.MY_ISSUES, PORTAL_PAGE.TEAM_ISSUES].includes(activePage);
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
      if (topBarRef.current.contains(event.target)) return;
      setIsShowMobileMenu(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  return (
    <>
      <div className="seaqa-portal-top-bar" ref={topBarRef}>
        <div className="seaqa-portal-top-bar-header">
          <div className="seaqa-portal-top-bar-logo d-flex align-items-center">
            <img src={logo} alt="" />
            <h3 className="text-truncate" title={name}>{name}</h3>
          </div>
          <div className="seaqa-portal-top-bar-tabs d-flex justify-content-center flex-1">
            <CustomizeTabs
              tabs={primaryTabs}
              value={activePrimaryTab}
              onChange={onPrimaryTabChange}
            />
          </div>
          <div className="seaqa-portal-top-bar-account">
            {/* Mobile menu toggle button */}
            <IconButton
              icon={isShowMobileMenu ? 'close' : 'menu'}
              onClick={(e) => {e.stopPropagation(); setIsShowMobileMenu(!isShowMobileMenu); }}
              className="seaqa-portal-mobile-top-bar-more-btn no-hover-bg"
              size={{ btn: 32, icon: 16 }}
            />
            <LanguageSelector />
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
          <div className="seaqa-portal-top-bar-mobile-menu">
            {primaryTabs.map((tab) => (
              <div
                className={classnames('seaqa-portal-top-bar-mobile-menu-item', { 'active': tab.value === activePrimaryTab })}
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

export default TopBar;
