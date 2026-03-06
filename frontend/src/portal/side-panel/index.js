import React from 'react';
import classnames from 'classnames';
import { Icon } from '../../components';
import { gettext, siteRoot } from '@/constants';
import { PORTAL_PAGE } from '../constants';

const BASE_NAV_ITEMS = [
  { key: PORTAL_PAGE.SUBMIT_TICKET, name: gettext('Submit ticket'), icon: 'submit-ticket' },
  { key: PORTAL_PAGE.MY_TICKETS, name: gettext('My tickets'), icon: 'my-tickets' },
];

const SidePanel = ({ activePage, onPageChange, enableKB, isAnonymous }) => {
  const navItems = isAnonymous
    ? (enableKB ? [{ key: PORTAL_PAGE.KNOWLEDGE_BASE, name: gettext('Knowledge base'), icon: 'knowledge-base' }] : [])
    : (enableKB
      ? [...BASE_NAV_ITEMS, { key: PORTAL_PAGE.KNOWLEDGE_BASE, name: gettext('Knowledge base'), icon: 'knowledge-base' }]
      : BASE_NAV_ITEMS);

  const { isEditMode, projectUuid, isExternalUser, username } = window.app.pageOptions;

  return (
    <div className="sea-qa-portal-side-panel">
      <div className="sea-qa-portal-side-panel-header">
        <div className="sea-qa-portal-side-panel-icon">
          <i className="project-icon icon-color-white icon-club-members"></i>
        </div>
        <h3>{gettext('Support portal')}</h3>
      </div>
      <div className="sea-qa-portal-navigation">
        {navItems.map(item => (
          <div
            key={item.key}
            className={classnames('sea-qa-portal-nav-item', { 'active': activePage === item.key })}
            onClick={() => onPageChange(item.key)}
          >
            <Icon symbol={item.icon} className="sea-qa-portal-nav-item-icon" />
            <span className="sea-qa-portal-nav-item-name">{item.name}</span>
          </div>
        ))}
        {!isEditMode && isAnonymous && (
          <div
            className="sea-qa-portal-nav-item"
            onClick={() => { window.location.href = siteRoot + `portal/${projectUuid}/login/`; }}
            title={gettext('Log in')}
          >
            <Icon symbol="support-portal" className="sea-qa-portal-nav-item-icon" />
            <span className="sea-qa-portal-nav-item-name">{gettext('Log in')}</span>
          </div>
        )}
        {!isEditMode && isExternalUser && !!username && (
          <div
            className="sea-qa-portal-nav-item"
            onClick={() => { window.location.href = siteRoot + `portal-external/logout/${projectUuid}/`; }}
            title={gettext('Log out')}
          >
            <Icon symbol="logout" className="sea-qa-portal-nav-item-icon" />
            <span className="sea-qa-portal-nav-item-name">{gettext('Log out')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SidePanel;
