import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { siteRoot, gettext } from '../../../constants';

const propTypes = {
  currentItem: PropTypes.string.isRequired
};

class ProjectNav extends React.Component {

  constructor(props) {
    super(props);
    this.navItems = [
      { name: 'all-projects', urlPart: 'all-projects', text: gettext('Projects') },
      { name: 'trash-projects', urlPart: 'trash-projects', text: gettext('Trash') },
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

ProjectNav.propTypes = propTypes;

export default ProjectNav;
