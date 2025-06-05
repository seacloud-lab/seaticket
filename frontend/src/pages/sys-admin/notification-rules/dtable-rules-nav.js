import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { siteRoot, gettext } from '../../../utils/constants';

const propTypes = {
  currentItem: PropTypes.string.isRequired
};

class DTableRulesNav extends React.Component {

  constructor(props) {
    super(props);
    this.navItems = [
      { name: 'notification-rules', urlPart: 'notification-rules', text: gettext('Notification rules') },
      { name: 'automation-rules', urlPart: 'automation-rules', text: gettext('Automation rules') },
      { name: 'invalid-notification-rules', urlPart: 'invalid-notification-rules', text: gettext('Invalid notification rules') },
      { name: 'invalid-automation-rules', urlPart: 'invalid-automation-rules', text: gettext('Invalid automation rules') },
    ];
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

DTableRulesNav.propTypes = propTypes;

export default DTableRulesNav;
