import React from 'react';
import PropTypes from 'prop-types';
import AsyncSelect from 'react-select/async';
import { gettext } from '../constants';

const propTypes = {
  placeholder: PropTypes.string.isRequired,
  onSelectChange: PropTypes.func.isRequired,
  isMulti: PropTypes.bool.isRequired,
  className: PropTypes.string,
  value: PropTypes.string,
  loadOptions: PropTypes.func
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

class GroupSelect extends React.Component {

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
    this.props.loadOptions(input, callback);
  };

  clearSelect = () => {
    this.refs.groupSelect.onChange([], { action: 'clear' });
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
              >{this.state.searchValue ? gettext('Group not found') : gettext('Enter characters to start searching')}
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
        ref="groupSelect"
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

GroupSelect.propTypes = propTypes;

export default GroupSelect;
