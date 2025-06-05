import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { siteRoot, gettext } from '../../../utils/constants';
import SysOrgFilterPopover from '../sys-popover/org-filter-popover';

const propTypes = {
  currentItem: PropTypes.string.isRequired,
  filters: PropTypes.object,
  updateSysFilter: PropTypes.func,
};

class Nav extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isFiltersPopoverShow: false,
    };
    this.navItems = [
      { name: 'organizations', urlPart: 'organizations', text: gettext('Organizations') },
      { name: 'big-data-storage', urlPart: 'organizations/big-data-storage', text: gettext('Big data storage') },
      { name: 'universal-apps', urlPart: 'organizations/universal-apps', text: gettext('Universal apps') },
    ];
  }

  onFilterToggle = () => {
    this.setState({ isFiltersPopoverShow: !this.state.isFiltersPopoverShow });
  };

  render() {

    const { isFiltersPopoverShow } = this.state;
    const { currentItem, filters } = this.props;
    const { orgRole } = filters || {};
    let isShowActiveFilter = false;
    if (orgRole) {
      isShowActiveFilter = true;
    }


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
        {currentItem === 'organizations' &&
          <div className="org-toolbar">
            <div className={`org-toolbar-item mr-2 ${isShowActiveFilter ? 'toolbar-actived-filter' : ''}`} id="dtable-filter-popover" onClick={this.onFilterToggle}>
              <span className="toolbar-btn">
                <i className="dtable-font dtable-icon-filter mr-1"></i>
                <span>{gettext('Filter')}</span>
              </span>
            </div>
          </div>
        }
        {isFiltersPopoverShow &&
          <SysOrgFilterPopover
            hideFilterPopover={this.onFilterToggle}
            updateSysFilter={this.props.updateSysFilter}
            filters={this.props.filters}
          />
        }
      </div>
    );
  }
}

Nav.propTypes = propTypes;

export default Nav;
