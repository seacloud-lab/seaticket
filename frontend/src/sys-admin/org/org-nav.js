import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Link } from '@gatsbyjs/reach-router';
import { SearchInput } from '@/components';
import { siteRoot, gettext } from '@/constants';

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
      { name: 'projects', urlPart: 'projects', text: gettext('Projects') },
    ];
  }

  render() {
    const { currentItem, orgID, onChangeSearchValue } = this.props;
    return (
      <div className='cur-view-path tab-nav-container pl-0 pr-0 d-flex justify-content-between align-items-center'>
        <ul className="nav">
          {this.navItems.map((item, index) => {
            return (
              <li className={classnames('nav-item', { 'active': currentItem === item.name })} key={index}>
                <Link
                  to={`${siteRoot}sys/organizations/${orgID}/${item.urlPart}/`}
                  className={classnames('nav-link pt-0 pb-0', { 'active': currentItem === item.name, 'ml-0': index === 0 })}
                >
                  {item.text}
                </Link>
              </li>
            );
          })}
        </ul>
        {currentItem === 'users' && (
          <div className="search-org-number input-icon">
            <SearchInput
              autoFocus={false}
              placeholder={gettext('Search member')}
              size={30}
              onChange={onChangeSearchValue}
            />
          </div>
        )}
      </div>
    );
  }
}

Nav.propTypes = propTypes;

export default Nav;
