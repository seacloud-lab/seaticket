import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { siteRoot, gettext } from '@/constants';

class GroupNav extends React.Component {

  render() {
    const { groupID, currentItem } = this.props;
    const urlBase = `${siteRoot}org/groups/${groupID}/`;
    const navItems = [
      { key: 'info', path: urlBase, text: gettext('Group Info') },
      { key: 'projects', path: `${urlBase}projects/`, text: gettext('Projects') },
      { key: 'members', path: `${urlBase}members/`, text: gettext('Members') }
    ];

    return (
      <div className="cur-view-path org-admin-user-nav tab-nav-container">
        <ul className="nav">
          {navItems.map(item => {
            const isActive = currentItem === item.key;
            return (
              <li key={item.key} className={`nav-item ${isActive ? 'active' : ''}`}>
                <Link to={item.path} className={`nav-link pt-0 pb-0 ${isActive ? 'active' : ''}`}>
                  {item.text}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
}

GroupNav.propTypes = {
  groupID: PropTypes.string.isRequired,
  currentItem: PropTypes.string.isRequired
};

export default GroupNav;
