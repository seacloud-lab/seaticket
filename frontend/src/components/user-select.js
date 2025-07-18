import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Popover } from 'reactstrap';
import { gettext } from '../constants';
import UserItem from './user-item';
import { seaQAAPI } from '../api/web-api';
import toaster from './toaster';
import ClickOutside from './click-outside';
import SearchInput from './search-input';
import { Utils } from '../utils/utils';

const propTypes = {
  placeholder: PropTypes.string.isRequired,
  onSelectChange: PropTypes.func.isRequired,
  isMulti: PropTypes.bool,
  className: PropTypes.string,
  excludeCurrentUser: PropTypes.bool,
  selectedUsers: PropTypes.array,
};

const { username } = window.app.pageOptions;

class UserSelect extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      maxItemNum: 0,
      itemHeight: 0,
      searchedUsers: [],
      searchValue: '',
      highlightIndex: -1,
    };
  }

  onValueChanged = (newSearchValue) => {
    this.setState({
      searchValue: newSearchValue
    });
    const searchValue = newSearchValue.trim();
    if (searchValue.length === 0) {
      this.setState({
        searchedUsers: [],
        highlightIndex: -1,
      });
    } else {
      seaQAAPI.searchUsers(searchValue).then((res) => {
        let users = res.data.users;
        if (this.props.excludeCurrentUser) {
          users = users.filter(user => user.email !== username);
        }
        this.setState({
          searchedUsers: users,
          highlightIndex: users.length > 0 ? 0 : -1,
        });
      }).catch(error => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(this.props.gettext(errMessage));
      });
    }
  };

  componentDidMount() {
    if (this.ref) {
      const { bottom } = this.ref.getBoundingClientRect();
      if (bottom > window.innerHeight) {
        this.ref.style.top = `${window.innerHeight - bottom}px`;
      }
    }
    if (this.container && this.userItem) {
      this.setState({
        maxItemNum: this.getMaxItemNum(),
        itemHeight: parseInt(getComputedStyle(this.userItem, null).height)
      });
    }
    document.addEventListener('keydown', this.onHotKey, true);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onHotKey, true);
  }

  onClickOutside = (e) => {
    if (e.target.id !== 'user-select' && this.state.isPopoverOpen) {
      this.setState({
        isPopoverOpen: false,
        searchedUsers: [],
        searchValue: '',
        highlightIndex: -1,
      });
    }
  };

  getMaxItemNum = () => {
    let userContainerStyle = getComputedStyle(this.container, null);
    let userItemStyle = getComputedStyle(this.userItem, null);
    let maxContainerItemNum = Math.floor(parseInt(userContainerStyle.maxHeight) / parseInt(userItemStyle.height));
    return maxContainerItemNum - 1;
  };

  onHotKey = (e) => {
    if (e.keyCode === Utils.keyCodes.enter) {
      this.onEnter(e);
    } else if (e.keyCode === Utils.keyCodes.up) {
      this.onUpArrow(e);
    } else if (e.keyCode === Utils.keyCodes.down) {
      this.onDownArrow(e);
    } else if (e.keyCode === Utils.keyCodes.escape) {
      this.onEsc(e);
    }
  };

  onEnter = (e) => {
    e.preventDefault();
    let user;
    if (this.state.searchedUsers.length === 1) {
      user = this.state.searchedUsers[0];
    } else if (this.state.highlightIndex > -1) {
      user = this.state.searchedUsers[this.state.highlightIndex];
    }
    if (user) {
      this.onUserClick(user);
    }
  };

  onUpArrow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    let { highlightIndex, maxItemNum, itemHeight } = this.state;
    if (highlightIndex > 0) {
      this.setState({ highlightIndex: highlightIndex - 1 }, () => {
        if (highlightIndex < this.state.searchedUsers.length - maxItemNum) {
          this.container.scrollTop -= itemHeight;
        }
      });
    } else {
      this.setState({ highlightIndex: this.state.searchedUsers.length - 1 }, () => {
        this.container.scrollTop = this.container.scrollHeight;
      });
    }
  };

  onDownArrow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    let { highlightIndex, maxItemNum, itemHeight } = this.state;
    if (highlightIndex < this.state.searchedUsers.length - 1) {
      this.setState({ highlightIndex: highlightIndex + 1 }, () => {
        if (highlightIndex >= maxItemNum) {
          this.container.scrollTop += itemHeight;
        }
      });
    } else {
      this.setState({ highlightIndex: 0 }, () => {
        this.container.scrollTop = 0;
      });
    }
  };

  onEsc = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ isPopoverOpen: false });
  };

  onUserClick = (user) => {
    const { isMulti = true } = this.props;
    let selectedUsers = this.props.selectedUsers.slice(0);
    const index = selectedUsers.findIndex(item => item.email === user.email);
    if (isMulti) {
      if (index > -1) {
        selectedUsers.splice(index, 1);
      } else {
        selectedUsers.push(user);
      }
    } else {
      if (index > -1) {
        selectedUsers = [];
      } else {
        selectedUsers = [user];
      }
    }
    this.props.onSelectChange(selectedUsers);
  };

  onKeyDown = (e) => {
    if (e.keyCode === Utils.keyCodes.left || e.keyCode === Utils.keyCodes.right) {
      e.stopPropagation();
    }
  };

  onDeleteSelectedCollaborator = (user) => {
    const { selectedUsers = [] } = this.props;
    const newSelectedCollaborator = selectedUsers.filter(item => item.email !== user.email);
    this.props.onSelectChange(newSelectedCollaborator);
  };

  onTogglePopover = () => {
    this.setState({ isPopoverOpen: !this.state.isPopoverOpen });
    if (!this.state.isPopoverOpen) {
      this.onValueChanged(this.state.searchValue);
    }
  };

  render() {
    const { searchValue, highlightIndex, searchedUsers, placeholder } = this.state;
    const { className = '', selectedUsers = [] } = this.props;
    return (
      <ClickOutside onClickOutside={this.onClickOutside}>
        <>
          <div className={classnames('selected-user-item-container form-control d-flex align-items-center', className, { 'focus': this.state.isPopoverOpen })} id="user-select" onClick={this.onTogglePopover}>
            {selectedUsers.map((user, index) => {
              return (
                <UserItem
                  key={index}
                  user={user}
                  enableDelete={true}
                  onDelete={this.onDeleteSelectedCollaborator}
                />
              );
            })}
            {selectedUsers.length === 0 && (
              <div className="user-select-placeholder">
                {placeholder || gettext('Search users')}
              </div>
            )}
          </div>
          <Popover
            placement="bottom-start"
            isOpen={this.state.isPopoverOpen}
            target={'user-select'}
            hideArrow={true}
            fade={false}
            className="user-select-popover"
          >
            <div className="user-select-container" ref={ref => this.ref = ref} onMouseDown={e => e.stopPropagation()}>
              <div className="user-search-container">
                <SearchInput
                  autoFocus={true}
                  isShowSearchIcon={false}
                  placeholder={placeholder || gettext('Search users')}
                  value={searchValue}
                  size={28}
                  onChange={this.onValueChanged}
                  onKeyDown={this.onKeyDown}
                />
              </div>
              <div className="user-list-container" ref={ref => this.container = ref}>
                {searchedUsers.length > 0 && (
                  searchedUsers.map((user, index) => {
                    return (
                      <div
                        key={user.email}
                        className={classnames('user-item-container', { 'user-item-container-highlight': index === highlightIndex })}
                        ref={ref => this.userItem = ref}
                        onClick={this.onUserClick.bind(this, user)}
                      >
                        <UserItem key={user.email} user={user} enableDelete={false} />
                        {selectedUsers.find(u => u.email === user.email) && (
                          <div className='collaborator-check-icon'>
                            <i className="dtable-font dtable-icon-check-mark" aria-hidden="true"></i>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                {searchedUsers.length === 0 &&
                  <div className="no-user-search-result">
                    {searchValue ? gettext('User not found') : gettext('Enter characters to start searching')}
                  </div>
                }
              </div>
            </div>
          </Popover>
        </>
      </ClickOutside>
    );
  }
}

UserSelect.propTypes = propTypes;

export default UserSelect;
