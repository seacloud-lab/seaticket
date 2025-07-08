import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { siteRoot, gettext } from '../../../constants';

const propTypes = {
  currentItem: PropTypes.string.isRequired,
  email: PropTypes.string,
  userName: PropTypes.string,
};

class Nav extends React.Component {

  constructor(props) {
    super(props);
    this.navItems = [
      { name: 'info', urlPart: '', text: gettext('Info') },
      { name: 'groups', urlPart: 'groups', text: gettext('Groups') },
      { name: 'projects', urlPart: 'projects', text: gettext('Projects') },
      { name: 'shared-projects', urlPart: 'shared-projects', text: gettext('Shared projects') },
      { name: 'storage', urlPart: 'storage', text: gettext('Storage') },
    ];
  }

  render() {
    const { currentItem, email, userName } = this.props;
    return (
      <div>
        <h2 className="heading">
          <Link to={`${siteRoot}sys/users/`}>{gettext('Users')}</Link> / {userName}
        </h2>
        <ul className="nav border-bottom mx-4">
          {this.navItems.map((item, index) => {
            return (
              <li className="nav-item mr-2" key={index}>
                <Link to={`${siteRoot}sys/users/${encodeURIComponent(email)}/${item.urlPart}`} className={`nav-link ${currentItem === item.name ? ' active' : ''}`}>{item.text}</Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
}

Nav.propTypes = propTypes;

export default Nav;
