import React from 'react';
import PropTypes from 'prop-types';
import { List } from 'antd-mobile';
import { gettext } from '../../utils/constants';
import MobileModal from './mobile-modal';

const propTypes = {
  column: PropTypes.object,
  value: PropTypes.array,
  onCommit: PropTypes.func,
  closeEditor: PropTypes.func,
};

class MultipSelectView extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      value: Array.isArray(props.value) ? props.value : [],
      searchVal: '',
      options: props.column.data ? props.column.data.options : [],
    };
  }

  onChangeSearch = (e) => {
    if (this.state.searchVal === e.target.value) return;
    this.setState({ searchVal: event.target.value });
  };

  onSelectOption = (option, e) => {
    e.stopPropagation();
    const optionID = option.id;
    let { value } = this.state;
    let optionIdx = value.indexOf(optionID);
    let updatedValue = value.slice(0);
    if (optionIdx > -1) {
      updatedValue.splice(optionIdx, 1);
    } else {
      updatedValue.push(optionID);
    }
    this.props.onCommit(updatedValue);
    this.setState({ value: updatedValue });
  };

  getValue = () => {
    const updated = {};
    updated[this.props.column.key] = this.state.value;
    return updated;
  };

  getFilteredOptions = () => {
    let { searchVal, options } = this.state;
    let val = searchVal.toLowerCase();
    return val ? options.filter((item) => item.name.toLowerCase().indexOf(val) > -1) : options;
  };

  renderList = () => {
    const options = this.getFilteredOptions();
    if (options.length === 0) {
      return <List.Item className="none-search-result">{gettext('No options available')}</List.Item>;
    }
    let { value } = this.state;
    return (
      <div className="options-container">
        {options.map((option, index) => {
          const isSelected = value.find((item) => item === option.id);
          return (
            <List.Item key={index} onClick={this.onSelectOption.bind(this, option)}>
              <div className="select-container">
                <span className="select-item">
                  <span className="select-name" style={{ backgroundColor: option.color, color: option.textColor || null }} title={option.name}>
                    {option.name}
                  </span>
                </span>
                <span className='select-check-icon'>
                  {isSelected && <i className="dtable-font dtable-icon-check-mark"></i>}
                </span>
              </div>
            </List.Item>
          );
        })}
      </div>
    );
  };

  renderSearch = () => {
    if (this.state.options.length <= 10) return null;
    return (
      <div className="mobile-search-selects">
        <input
          className="form-control"
          type="text"
          placeholder={gettext('Search option')}
          value={this.state.searchVal}
          onChange={this.onChangeSearch}
          onClick={(e) => {e.stopPropagation();}}
        />
      </div>
    );
  };

  render() {
    return (
      <MobileModal closeModal={this.props.closeEditor}>
        <List renderHeader={this.props.column.name} className="popup-list mobile-select-editor">
          {this.renderSearch()}
          {this.renderList()}
        </List>
      </MobileModal>
    );
  }
}

MultipSelectView.propTypes = propTypes;

export default MultipSelectView;
