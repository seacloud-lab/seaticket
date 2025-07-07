import React from 'react';
import PropTypes from 'prop-types';
import { toaster, Loading } from '../../../components';
import { Utils } from '../../../utils/utils';
import { seaQAAPI } from '../../../api/web-api';
import { gettext } from '../../../constants/config';

const propTypes = {
  selectedOptions: PropTypes.array,
  toggle: PropTypes.func,
  setUser: PropTypes.func,
};

class SelectUser extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isSelectUserModalShow: true,
      searchVal: '',
      userList: [],
      selectedOptions: props.selectedOptions || [],
      isLoading: false
    };
  }

  onChangeSearch = (e) => {
    if (this.state.searchVal === e.target.value) return;
    this.setState({ searchVal: e.target.value }, () => {
      this.getFilteredCollaborators();
    });
  };

  onSelectUserModalToggle = () => {
    this.setState({
      isSelectUserModalShow: !this.state.isSelectUserModalShow
    }, () => {
      this.props.toggle();
    });
  };

  getFilteredCollaborators = () => {
    let value = this.state.searchVal;
    if (!value.trim()) return this.setState({ userList: [] });
    this.setState({ isLoading: true });
    seaQAAPI.searchUsers(value).then((res) => {
      let userList = [];
      for (let i = 0 ; i < res.data.users.length; i++) {
        const item = res.data.users[i];
        let obj = {};
        obj.name = item.name;
        obj.email = item.email;
        obj.avatar_url = item.avatar_url;
        userList.push(obj);
      }
      this.setState({ userList, isLoading: false });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onChange = (event, userItem) => {
    event.stopPropagation();
    let newSelectedOptions = this.state.selectedOptions.slice(0);
    const optionIndex = newSelectedOptions.findIndex(optionItem => optionItem && optionItem.email === userItem.email);
    if (optionIndex > -1) {
      newSelectedOptions.splice(optionIndex, 1);
    } else {
      newSelectedOptions.push(userItem);
    }

    this.setState({ selectedOptions: newSelectedOptions });
  };

  setUser = () => {
    const { selectedOptions } = this.state;

    this.props.setUser(selectedOptions);
    this.onSelectUserModalToggle();
  };

  renderHeader = () => {
    return (
      <div className="modal-select-user-header">
        <span>{gettext('Select user')}</span>
        <span className="select-user-close-btn" onClick={this.setUser}>{gettext('Done')}</span>
      </div>
    );
  };

  renderSearch = () => {
    return (
      <div className="mobile-search-selects">
        <span className="mobile-search-user dtable-font dtable-icon-search"></span>
        <input
          className="form-control"
          type="text"
          placeholder={gettext('Search users')}
          value={this.state.searchVal}
          onChange={this.onChangeSearch}
          onClick={(e) => {e.stopPropagation();}}
        />
      </div>
    );
  };

  renderList = () => {
    const { userList, selectedOptions, searchVal, isLoading } = this.state;
    if (isLoading) return <div className="mobile-list-item no-search-result"><Loading /></div>;

    if (userList.length === 0 && searchVal && !isLoading ) {
      return <div className="mobile-list-item no-search-result">{gettext('User not found')}</div>;
    }
    return (
      <div className="options-container">
        {userList.map((option) => {
          const isSelectedOption = selectedOptions.find((item) => item.email === option.email);
          return (
            <div className="mobile-list-item" key={option.email} onClick={(event) => this.onChange(event, option)}>
              <div className="select-container">
                <span className="select-item">
                  <img className="select-avatar" alt={option.name} src={option.avatar_url} />
                  <span className="select-name" title={option.name} aria-label={option.name}>{option.name}</span>
                </span>
                {isSelectedOption &&
                  <span className='select-check-icon'>
                    <i className="dtable-font dtable-icon-check-mark"></i>
                  </span>
                }
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  render() {
    const { userList, searchVal, isSelectUserModalShow } = this.state;
    return (
      <div className={isSelectUserModalShow ? '' : 'd-none'} onClick={this.onSelectUserModalToggle}>
        <div className="mobile-operation-menu-bg-layer"></div>
        <div className="mobile-operation-menu select-user-modal">
          {this.renderHeader()}
          {this.renderSearch()}
          {(userList.length > 0 || searchVal) &&
            <div className="mobile-list">
              {this.renderList()}
            </div>
          }
        </div>
      </div>
    );
  }
}

SelectUser.propTypes = propTypes;

export default SelectUser;
