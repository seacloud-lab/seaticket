import React from 'react';
import PropTypes from 'prop-types';
import AsyncSelect from 'react-select/async';
import toaster from './toaster';
import { seaQAAPI } from '../api/web-api.js';
import { gettext, enableShowIDInOrgWhenSearchUser } from '../constants/config.js';
import { Utils } from '../utils/utils.js';
import { UserSelectStyle } from './customize-react-select/utils.js';

import './customize-react-select/user-select.css';
import '../css/user-select.css';

const propTypes = {
  placeholder: PropTypes.string.isRequired,
  onSelectChange: PropTypes.func.isRequired,
  isMulti: PropTypes.bool.isRequired,
  className: PropTypes.string,
  value: PropTypes.string,
  excludeCurrentUser: PropTypes.bool,
};

const { username } = window.app.pageOptions;

class UserSelect extends React.Component {

  constructor(props) {
    super(props);
    this.options = [];
    this.state = {
      searchValue: '',
    };
  }

  handleSelectChange = (option) => {
    this.options = [];
    if (!this.props.isMulti && Array.isArray(option) && option.length > 0) {
      this.props.onSelectChange(option[0]);
    } else {
      this.props.onSelectChange(option);
    }
  };

  onInputChange = (searchValue) => {
    if (!this.props.isMulti && searchValue.trim()) {
      this.handleSelectChange(null);
      this.clearSelect();
    }
    this.setState({ searchValue });
  };

  loadOptions = (input, callback) => {
    const value = input.trim();
    if (value.length > 0) {
      seaQAAPI.searchUsers(value).then((res) => {
        this.options = [];
        for (let i = 0 ; i < res.data.users.length; i++) {
          const item = res.data.users[i];
          if (this.props.excludeCurrentUser && item.email === username) {
            continue;
          }
          let obj = {};
          obj.value = item.name;
          obj.email = item.email;
          obj.avatar_url = item.avatar_url;
          obj.label = enableShowIDInOrgWhenSearchUser ? (
            <div className="select-module-container select-module-container-orgid">
              <img src={item.avatar_url} className="select-module select-module-avatar" width="24" alt="" />
              <div className="ml-2">
                <span className="user-option-name">{item.name}</span>
                {item.id_in_org && <><br /><span className="user-option-email">{item.id_in_org}</span></>}
              </div>
            </div>
          ) : (
            <div className="select-module-container">
              <img src={item.avatar_url} className="select-module select-module-avatar" alt=""/>
              <span className='select-module select-module-name'>{item.name}</span>
            </div>
          );
          this.options.push(obj);
        }
        callback(this.options);
      }).catch(error => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
    }
  };

  clearSelect = () => {
    this.refs.userSelect.onChange([], { action: 'clear' });
  };

  render() {
    return (
      <AsyncSelect
        isClearable
        classNamePrefix
        components={{
          NoOptionsMessage: (props) => {
            return (
              <div
                {...props.innerProps}
                style={{ margin: '6px 10px', textAlign: 'center', color: 'hsl(0,0%,50%)' }}
              >{this.state.searchValue ? gettext('User not found') : gettext('Enter characters to start searching')}
              </div>
            );
          }
        }}
        isMulti={true}
        loadOptions={this.loadOptions}
        onChange={this.handleSelectChange}
        onInputChange={this.onInputChange}
        placeholder={this.props.placeholder}
        className={`user-select ${this.props.className}`}
        value={this.props.value}
        ref="userSelect"
        theme={theme => ({
          ...theme,
          colors: {
            ...theme.colors,
            primary25: '#f5f5f5',
          },
        })}
        styles={UserSelectStyle}
      />
    );
  }
}

UserSelect.propTypes = propTypes;

export default UserSelect;
