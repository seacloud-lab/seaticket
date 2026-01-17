import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Link } from '@gatsbyjs/reach-router';
import { siteRoot, gettext } from '@/constants';

const propTypes = {
  currentItem: PropTypes.string.isRequired
};

class StatisticNav extends React.Component {

  constructor(props) {
    super(props);
    this.navItems = [
      { name: 'ai', urlPart: 'statistics', text: gettext('AI') },
    ];
  }

  render() {
    const { currentItem } = this.props;
    return (
      <div className="cur-view-path tab-nav-container">
        <ul className="nav">
          {this.navItems.map((item, index) => {
            return (
              <li className={classnames('nav-item', { 'active': currentItem === item.name })} key={index}>
                <Link to={`${siteRoot}sys/${item.urlPart}/`} className={`nav-link${currentItem === item.name ? ' active' : ''}`}>{item.text}</Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
}

StatisticNav.propTypes = propTypes;

export default StatisticNav;
