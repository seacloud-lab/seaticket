import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { DTableSearchInput } from 'dtable-ui-component';
import { siteRoot, gettext } from '../../../utils/constants';

const propTypes = {
  currentItem: PropTypes.string.isRequired,
  groupID: PropTypes.string.isRequired,
  groupName: PropTypes.string.isRequired,
  searchValue: PropTypes.string,
  onChangeSearchValue: PropTypes.func,
};

class Nav extends React.Component {

  constructor(props) {
    super(props);
    this.navItems = [
      { name: 'bases', urlPart: 'groups/' + this.props.groupID + '/dtables', text: gettext('Bases') },
      { name: 'members', urlPart: 'groups/' + this.props.groupID + '/members', text: gettext('Members') },
      { name: 'storages', urlPart: 'groups/' + this.props.groupID + '/storages', text: gettext('Storage') }
    ];
  }

  render() {
    const { groupName, currentItem, onChangeSearchValue } = this.props;
    return (
      <div className="group-nav-container">
        <h2 className="heading">
          <Link to={`${siteRoot}sys/groups/`}>{gettext('Groups')}</Link> / {groupName}
        </h2>
        <div className="d-flex justify-content-between align-items-center border-bottom mx-4">
          <ul className="nav">
            {this.navItems.map((item, index) => {
              return (
                <li className="nav-item mr-2" key={index}>
                  <Link to={`${siteRoot}sys/${item.urlPart}/`} className={`nav-link ${currentItem === item.name ? ' active' : ''}`}>{item.text}</Link>
                </li>
              );
            })}
          </ul>
          {currentItem === 'members' && (
            <div className="search-group-member input-icon">
              <i className="search-icon-left input-icon-addon dtable-font dtable-icon-search" />
              <DTableSearchInput
                autoFocus={false}
                placeholder={gettext('Search member')}
                style={{ height: '30px' }}
                onChange={onChangeSearchValue}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
}

Nav.propTypes = propTypes;

export default Nav;
