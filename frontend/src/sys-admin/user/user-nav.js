import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Link } from '@gatsbyjs/reach-router';
import { siteRoot, gettext } from '@/constants';

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
    ];
  }

  render() {
    const { currentItem, email } = this.props;
    return (
      <div>
        <ul className="nav border-bottom">
          {this.navItems.map((item, index) => {
            return (
              <li className="nav-item mr-2" key={index}>
                <Link
                  to={`${siteRoot}sys/users/${encodeURIComponent(email)}/${item.urlPart}`}
                  className={classnames('nav-link pt-0 pb-0', { 'active': currentItem === item.name, 'ml-0': index === 0 })}
                >
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

Nav.propTypes = propTypes;

export default Nav;
