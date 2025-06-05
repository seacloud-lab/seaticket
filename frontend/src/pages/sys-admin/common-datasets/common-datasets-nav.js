import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { siteRoot, gettext } from '../../../utils/constants';

const propTypes = {
  currentItem: PropTypes.string.isRequired
};

class CommonDatasetsNav extends React.Component {

  constructor(props) {
    super(props);
    this.navItems = [
      { name: 'common-datasets', urlPart: 'common-datasets', text: gettext('Common datasets') },
      { name: 'periodical-syncs', urlPart: 'periodical-syncs', text: gettext('Periodical syncs') },
      { name: 'invalid-syncs', urlPart: 'invalid-syncs', text: gettext('Invalid syncs') },
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

CommonDatasetsNav.propTypes = propTypes;

export default CommonDatasetsNav;
