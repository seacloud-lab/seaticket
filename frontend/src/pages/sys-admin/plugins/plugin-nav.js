import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { gettext, siteRoot } from '../../../utils/constants';

const propTypes = {
  currentItem: PropTypes.string.isRequired
};

class PluginNav extends React.Component {

  constructor(props) {
    super(props);
    this.navItems = [
      { name: 'plugins', urlPart: 'plugins', text: gettext('Plugins') },
      { name: 'plugins-install-count', urlPart: 'plugins-install-count', text: gettext('Plugins install count') }
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

PluginNav.propTypes = propTypes;

export default PluginNav;
