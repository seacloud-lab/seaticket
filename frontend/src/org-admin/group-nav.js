import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { siteRoot, gettext } from '@/constants';

class GroupNav extends React.Component {

  render() {
    const { groupID, currentItem } = this.props;
    const urlBase = `${siteRoot}org/groups/${groupID}/`;
    return (
      <div className="cur-view-path org-admin-user-nav tab-nav-container">
        <ul className="nav">
          <li className="nav-item">
            <Link to={urlBase} className={`nav-link pt-0 pb-0 ${currentItem === 'info' ? 'active' : ''}`}>{gettext('Group Info')}</Link>
          </li>
          <li className="nav-item">
            <Link to={`${urlBase}projects/`} className={`nav-link pt-0 pb-0 ${currentItem === 'projects' ? 'active' : ''}`}>{gettext('Projects')}</Link>
          </li>
          <li className="nav-item">
            <Link to={`${urlBase}members/`} className={`nav-link pt-0 pb-0 ${currentItem === 'members' ? 'active' : ''}`}>{gettext('Members')}</Link>
          </li>
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
