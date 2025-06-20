import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { DTableSearchInput } from 'dtable-ui-component';
import { siteRoot, gettext } from '../../../constants';

const propTypes = {
  currentItem: PropTypes.string.isRequired,
  orgName: PropTypes.string,
  orgID: PropTypes.string,
  searchValue: PropTypes.string,
  onChangeSearchValue: PropTypes.func,
};

class Nav extends React.Component {

  constructor(props) {
    super(props);
    this.navItems = [
      { name: 'info', urlPart: 'info', text: gettext('Info') },
      { name: 'users', urlPart: 'users', text: gettext('Members') },
      { name: 'admin-users', urlPart: 'admin-users', text: gettext('Admins') },
      { name: 'groups', urlPart: 'groups', text: gettext('Groups') },
      { name: 'dtables', urlPart: 'dtables', text: gettext('Bases') },
      { name: 'external-apps', urlPart: 'external-apps', text: gettext('Apps') },
      { name: 'external-links', urlPart: 'external-links', text: gettext('External links') },
      { name: 'view-external-links', urlPart: 'view-external-links', text: gettext('View external links') },
      // {name: 'traffic', urlPart: 'traffic', text: gettext('traffic')},
      // {name: 'settings', urlPart: 'settings', text: gettext('Settings')}
    ];
  }

  render() {
    const { currentItem, orgID, orgName, onChangeSearchValue } = this.props;
    return (
      <div className="org-nav-container">
        <h2 className="heading">
          <Link to={`${siteRoot}sys/organizations/`}>{gettext('Organizations')}</Link> / {orgName}
        </h2>
        <div className='d-flex justify-content-between align-items-center border-bottom mx-4'>
          <ul className="nav">
            {this.navItems.map((item, index) => {
              return (
                <li className="nav-item mr-2" key={index}>
                  <Link
                    to={`${siteRoot}sys/organizations/${orgID}/${item.urlPart}/`}
                    className={`nav-link ${currentItem === item.name ? ' active' : ''}`}
                  >{item.text}
                  </Link>
                </li>
              );
            })}
          </ul>
          {currentItem === 'users' && (
            <div className="search-org-number input-icon">
              <i className="search-icon-left input-icon-addon dtable-font dtable-icon-search" />
              <DTableSearchInput
                autoFocus={false}
                placeholder={gettext('Search member')}
                style={{ height: '30px' }}
                onChange={onChangeSearchValue}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
}

Nav.propTypes = propTypes;

export default Nav;
