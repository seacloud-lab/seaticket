import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { gettext, siteRoot } from '../../../utils/constants';

const propTypes = {
  currentItem: PropTypes.string.isRequired
};

class FormTableNav extends React.Component {

  constructor(props) {
    super(props);
    this.navItems = [
      { name: 'forms', urlPart: 'all-forms', text: gettext('Form') },
      { name: 'collection-tables', urlPart: 'all-collection-tables', text: gettext('Collection table') }
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

FormTableNav.propTypes = propTypes;

export default FormTableNav;
