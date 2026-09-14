import React from 'react';
import { Popover } from 'reactstrap';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import userAPI from '@/api/user-api';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import CenteredLoading from '../centered-loading';
import ClickOutside from '../click-outside';
import IconButton from '../icon-button';
import SearchInput from '../search-input';
import toaster from '../toaster';
import UserItem from '../user-item';

const propTypes = {
  placeholder: PropTypes.string.isRequired,
  onSelectChange: PropTypes.func.isRequired,
  isMulti: PropTypes.bool,
  className: PropTypes.string,
  excludeCurrentUser: PropTypes.bool,
  selectedUsers: PropTypes.array,
  allowEmptySearch: PropTypes.bool,
  emptyMessage: PropTypes.string,
  onPopoverToggle: PropTypes.func,
  popoverClassName: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  showDropdownIndicator: PropTypes.bool,
  showSearchClearIcon: PropTypes.bool,
  searchInputSize: PropTypes.number,
  popoverOffset: PropTypes.oneOfType([PropTypes.array, PropTypes.string, PropTypes.number]),
  hideSearchWhenEmpty: PropTypes.bool,
  matchTargetWidth: PropTypes.bool,
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
      isLoading: false,
    };
  }

  onValueChanged = (newSearchValue) => {
    this.setState({
      searchValue: newSearchValue
    });
    const searchValue = newSearchValue.trim();
    if (searchValue.length === 0 && !this.props.allowEmptySearch) {
      this.setState({
        searchedUsers: [],
        highlightIndex: -1,
      });
    } else {
      this.setState({ isLoading: true });
      const api = this.props.api || ((searchValue) => userAPI.searchUsers(searchValue));
      api(searchValue).then((res) => {
        let users = res.data.users;
        if (this.props.excludeCurrentUser) {
          users = users.filter(user => user.email !== username);
        }
        this.setState({
          isLoading: false,
          searchedUsers: users,
          highlightIndex: users.length > 0 ? 0 : -1,
        });
      }).catch(error => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(this.props.gettext(errMessage));
        this.setState({ isLoading: false });
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

  closePopover = () => {
    if (!this.state.isPopoverOpen) return;
    this.setState({
      isPopoverOpen: false,
      searchedUsers: [],
      searchValue: '',
      highlightIndex: -1,
    });
    this.props.onPopoverToggle && this.props.onPopoverToggle(false);
  };

  onClickOutside = (e) => {
    if (this.state.isPopoverOpen && (!this.selectRef || !this.selectRef.contains(e.target))) {
      this.closePopover();
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
    } else if (e.keyCode === Utils.keyCodes.esc) {
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
    this.closePopover();
  };

  onUserClick = (user) => {
    const { isMulti = true, selectedUsers: oldUsers = [] } = this.props;
    let selectedUsers = oldUsers.slice(0);
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
    if (!isMulti) {
      this.setState({
        isPopoverOpen: false,
        searchedUsers: [],
        searchValue: '',
        highlightIndex: -1,
      });
    }
  };

  onKeyDown = (e) => {
    if (e.keyCode === Utils.keyCodes.left || e.keyCode === Utils.keyCodes.right) {
      e.stopPropagation();
    }
  };

  onClearSearch = () => {
    this.onValueChanged('');
  };

  onDeleteSelectedCollaborator = (user) => {
    const { selectedUsers = [] } = this.props;
    const newSelectedCollaborator = selectedUsers.filter(item => item.email !== user.email);
    this.props.onSelectChange(newSelectedCollaborator);
  };

  onTogglePopover = () => {
    if (this.state.isPopoverOpen) {
      this.closePopover();
      return;
    }
    this.setState({ isPopoverOpen: true });
    this.props.onPopoverToggle && this.props.onPopoverToggle(true);
    this.onValueChanged(this.state.searchValue);
  };

  render() {
    const { searchValue, highlightIndex, searchedUsers, isLoading } = this.state;
    const {
      className = '', emptyMessage, popoverClassName,
      placeholder, searchPlaceholder, selectedUsers = [], showDropdownIndicator, showSearchClearIcon,
      searchInputSize = 28, popoverOffset, hideSearchWhenEmpty, matchTargetWidth,
    } = this.props;
    const isEmptyWithoutSearch = !isLoading && !searchValue && searchedUsers.length === 0;
    const shouldHideSearch = hideSearchWhenEmpty && isEmptyWithoutSearch;
    const modifiers = matchTargetWidth ? [{
      name: 'matchTargetWidth',
      enabled: true,
      phase: 'beforeWrite',
      requires: ['computeStyles'],
      fn: ({ state }) => {
        state.styles.popper.width = `${state.rects.reference.width}px`;
      },
    }] : [];
    return (
      <ClickOutside onClickOutside={this.onClickOutside}>
        <>
          <div className={classnames('selected-user-item-container form-control d-flex align-items-center', className, { 'focus': this.state.isPopoverOpen })} id="user-select" onClick={this.onTogglePopover} ref={ref => this.selectRef = ref}>
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
            {showDropdownIndicator && (
              <IconButton icon="arrow-down" className="user-select-dropdown-indicator ml-auto no-hover-bg" />
            )}
          </div>
          <Popover
            placement="bottom-start"
            isOpen={this.state.isPopoverOpen}
            target={'user-select'}
            hideArrow={true}
            fade={false}
            className={classnames('user-select-popover', popoverClassName)}
            popperClassName={popoverClassName}
            offset={popoverOffset}
            modifiers={modifiers}
          >
            <div className="user-select-container" ref={ref => this.ref = ref} onMouseDown={e => e.stopPropagation()}>
              {!shouldHideSearch && (
                <div className="user-search-container">
                  <SearchInput
                    autoFocus={true}
                    isShowSearchIcon={false}
                    placeholder={searchPlaceholder || placeholder || gettext('Search users')}
                    value={searchValue}
                    size={searchInputSize}
                    onChange={this.onValueChanged}
                    isShowClearIcon={showSearchClearIcon && Boolean(searchValue)}
                    onClear={this.onClearSearch}
                    onKeyDown={this.onKeyDown}
                  />
                </div>
              )}
              <div className="user-list-container" ref={ref => this.container = ref}>
                {isLoading && <CenteredLoading style={{ minHeight: '160px' }} />}
                {!isLoading && searchedUsers.length > 0 && (
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
                          <IconButton icon="check-mark" className="collaborator-check-icon" />
                        )}
                      </div>
                    );
                  })
                )}
                {!isLoading && searchedUsers.length === 0 &&
                  <div className="no-user-search-result">
                    {searchValue ? gettext('User not found') : (emptyMessage || gettext('Enter characters to start searching'))}
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
