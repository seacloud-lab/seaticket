import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { gettext, siteRoot } from '../../../utils/constants';

const propTypes = {
  currentItem: PropTypes.string.isRequired
};

class NotificationNav extends React.Component {

  constructor(props) {
    super(props);
    this.navItems = [
      { name: 'notifications', urlPart: 'notifications', text: gettext('All notifications') },
      { name: 'user-notifications', urlPart: 'user-notifications', text: gettext('User notifications') }
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
                <Link to={`${siteRoot}sys/${item.urlPart}/`}
                  className={`nav-link${currentItem === item.name ? ' active' : ''}`}>{item.text}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
}

NotificationNav.propTypes = propTypes;

export default NotificationNav;
