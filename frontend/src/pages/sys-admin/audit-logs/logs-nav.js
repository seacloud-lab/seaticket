import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { siteRoot, gettext, canUseAdvancedPerms } from '../../../utils/constants';

const propTypes = {
  currentItem: PropTypes.string.isRequired
};

class LogsNav extends React.Component {

  constructor(props) {
    super(props);
    this.navItems = [
      { name: 'loginLogs', urlPart: 'logs/login', text: gettext('Login logs') },
    ];
    if (canUseAdvancedPerms) {
      this.navItems.push({ name: 'auditLogs', urlPart: 'audit-logs', text: gettext('Action logs') });
      this.navItems.push({ name: 'fileAccessLogs', urlPart: 'file-access-logs', text: gettext('File access logs') });
    }
  }

  render() {
    const { currentItem } = this.props;
    return (
      <div className="cur-view-path tab-nav-container">
        <ul className="nav">
          {this.navItems.map((item, index) => {
            return (
              <li className="nav-item" key={index}>
                <Link to={`${siteRoot}sys/${item.urlPart}/`} className={`nav-link${currentItem === item.name ? ' active' : ''}`}>{item.text}</Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
}

LogsNav.propTypes = propTypes;

export default LogsNav;
