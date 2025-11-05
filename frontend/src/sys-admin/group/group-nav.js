import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import classnames from 'classnames';
import { SearchInput } from '@/components';
import { siteRoot, gettext } from '@/constants';

const propTypes = {
  currentItem: PropTypes.string.isRequired,
  groupID: PropTypes.string.isRequired,
  searchValue: PropTypes.string,
  onChangeSearchValue: PropTypes.func,
};

class GroupNav extends React.Component {

  constructor(props) {
    super(props);
    this.navItems = [
      { name: 'projects', urlPart: 'groups/' + this.props.groupID + '/projects', text: gettext('Projects') },
      { name: 'members', urlPart: 'groups/' + this.props.groupID + '/members', text: gettext('Members') },
    ];
  }

  render() {
    const { currentItem, searchValue, onChangeSearchValue } = this.props;
    return (
      <div className="d-flex justify-content-between align-items-center border-bottom">
        <ul className="nav">
          {this.navItems.map((item, index) => {
            return (
              <li className="nav-item mr-2" key={index}>
                <Link
                  to={`${siteRoot}sys/${item.urlPart}/`}
                  className={classnames('nav-link pt-0 pb-0', { 'active': currentItem === item.name, 'ml-0': index === 0 })}
                >
                  {item.text}
                </Link>
              </li>
            );
          })}
        </ul>
        {currentItem === 'members' && (
          <div className="search-group-member input-icon">
            <SearchInput
              autoFocus={false}
              placeholder={gettext('Search member')}
              size={30}
              value={searchValue}
              onChange={onChangeSearchValue}
            />
          </div>
        )}
      </div>
    );
  }
}

GroupNav.propTypes = propTypes;

export default GroupNav;
