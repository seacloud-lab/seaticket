import React from 'react';
import PropTypes from 'prop-types';
import AsyncSelect from 'react-select/async';
import toaster from '../toaster';
import { gettext } from '../../constants';
import { Utils } from '../../utils/utils.js';
import { sysAdminServiceApi } from '../../api/sys-admin-service-api.js';

const SEARCH_LIMIT = 10;

const propTypes = {
  placeholder: PropTypes.string.isRequired,
  onSelectChange: PropTypes.func.isRequired,
  isMulti: PropTypes.bool.isRequired,
  className: PropTypes.string,
  value: PropTypes.string,
  excludeCurrentUser: PropTypes.bool,
  orgID: PropTypes.number,
};

const customStyles = {
  indicatorSeparator: () => ({
    display: 'none',
  }),
  dropdownIndicator: () => ({
    display: 'none',
  }),
  clearIndicator: () => ({
    display: 'none',
  }),
  singleValue: () => {
    return {
      backgroundColor: 'hsl(0, 0%, 90%)',
      borderRadius: '2px',
      display: 'flex',
      margin: '2px',
      minWidth: 0,
      boxSizing: 'border-box',
      padding: '3px 6px',
    };
  }
};

const { username } = window.app.pageOptions;

class SysAdminUserSelect extends React.Component {

  constructor(props) {
    super(props);
    this.options = [];
    this.state = {
      searchValue: '',
    };
  }

  handleSelectChange = (option) => {
    this.options = [];
    this.props.onSelectChange(option);
  };

  onInputChange = (searchValue) => {
    this.setState({ searchValue });
  };

  loadOptions = (input, callback) => {
    const value = input.trim();
    if (value.length > 0) {
      sysAdminServiceApi.sysAdminSearchUserByOrgID(value, this.props.orgID, SEARCH_LIMIT).then((res) => {
        this.options = [];
        for (let i = 0 ; i < res.data.users.length; i++) {
          const item = res.data.users[i];
          if (this.props.excludeCurrentUser && item.user === username) {
            continue;
          }
          let obj = {};
          obj.value = item.nickname;
          obj.email = item.user;
          obj.avatar_url = item.avatar_url;
          obj.label =
            <React.Fragment>
              <img src={item.avatar_url} className="select-module select-module-icon avatar" alt=""/>
              <span className='select-module select-module-name'>{item.nickname}</span>
            </React.Fragment>;
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
        isMulti={this.props.isMulti}
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
        styles={customStyles}
      />
    );
  }
}

SysAdminUserSelect.propTypes = propTypes;

export default SysAdminUserSelect;
