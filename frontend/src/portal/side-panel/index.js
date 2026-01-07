import React from 'react';
import classnames from 'classnames';
import { Icon } from '../../components';
import { gettext } from '@/constants';
import { PORTAL_PAGE } from '../constants';

const NAV_ITEMS = [
  { key: PORTAL_PAGE.SUBMIT_TICKET, name: gettext('Submit ticket'), icon: 'submit-ticket' },
  { key: PORTAL_PAGE.MY_TICKETS, name: gettext('My tickets'), icon: 'my-tickets' },
];

const SidePanel = ({ activePage, onPageChange }) => {
  return (
    <div className="sea-qa-portal-side-panel">
      <div className="sea-qa-portal-side-panel-header">
        <div className="sea-qa-portal-side-panel-icon">
          <i className="project-icon icon-color-white icon-club-members"></i>
        </div>
        <h3>support portal</h3>
      </div>
      <div className="sea-qa-portal-navigation">
        {NAV_ITEMS.map(item => (
          <div
            key={item.key}
            className={classnames('sea-qa-portal-nav-item', { 'active': activePage === item.key })}
            onClick={() => onPageChange(item.key)}
          >
            <Icon symbol={item.icon} className="sea-qa-portal-nav-item-icon" />
            <span className="sea-qa-portal-nav-item-name">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SidePanel;
