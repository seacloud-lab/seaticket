import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import ModalPortal from '../modal-portal';
import OptionGroup from './select-option-group';
import Icon from '../icon';
import { getEventClassName } from '@/utils/dom';

import './index.css';

class CustomizeSelect extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowSelectOptions: false
    };
  }

  onSelectToggle = (event) => {
    event.preventDefault();
    /*
      if select is showing, click events do not need to be monitored by other click events,
      so it can be closed when other select is clicked.
    */
    if (this.state.isShowSelectOptions) event.stopPropagation();
    let eventClassName = getEventClassName(event);
    if (this.props.disabled || eventClassName.indexOf('option-search-control') > -1 || eventClassName === 'option-group-search') return;
    // Prevent closing by pressing the spacebar in the search input
    if (event.target.value === '') return;
    this.setState({
      isShowSelectOptions: !this.state.isShowSelectOptions
    });
  };

  onClick = (event) => {
    if (this.props.isShowSelected && event.target.className.includes('icon-fork-number')) {
      return;
    }
    if (!this.selector.contains(event.target)) {
      this.closeSelect();
    }
  };

  closeSelect = () => {
    this.setState({ isShowSelectOptions: false });
  };

  getSelectedOptionTop = () => {
    if (!this.selector) return 38;
    const { height } = this.selector.getBoundingClientRect();
    return height;
  };

  getFilterOptions = (searchValue) => {
    const { options, searchable } = this.props;
    if (!searchable) return options || [];
    const validSearchVal = searchValue.trim().toLowerCase();
    if (!validSearchVal) return options || [];
    return options.filter(option => {
      const { name } = option;
      if (typeof name === 'string') {
        return name.toLowerCase().indexOf(validSearchVal) > -1;
      }
      return false;
    });
  };

  render() {
    let { className, value, options, placeholder, searchable, searchPlaceholder, noOptionsPlaceholder,
      disabled, isInModal, addOptionAble, component, id } = this.props;
    return (
      <div
        ref={(node) => this.selector = node}
        className={classnames('seaqa-select custom-select seaqa-customize-select',
          { 'focus': this.state.isShowSelectOptions },
          { 'disabled': disabled },
          className
        )}
        id={id}
        onClick={this.onSelectToggle}
      >
        <div className="selected-option">
          {value && value.label ?
            <span className="selected-option-show">{value.label}</span>
            :
            <span className="select-placeholder">{placeholder}</span>
          }
          {!disabled && (<Icon symbol="arrow-down" />)}
        </div>
        {this.state.isShowSelectOptions && !isInModal && (
          <OptionGroup
            value={value}
            addOptionAble={addOptionAble}
            component={component}
            isShowSelected={this.props.isShowSelected}
            top={this.getSelectedOptionTop()}
            options={options}
            onChange={this.props.onChange}
            searchable={searchable}
            searchPlaceholder={searchPlaceholder}
            noOptionsPlaceholder={noOptionsPlaceholder}
            onClickOutside={this.onClick}
            closeSelect={this.closeSelect}
            getFilterOptions={this.getFilterOptions}
            supportMultipleSelect={this.props.supportMultipleSelect}
          />
        )}
        {this.state.isShowSelectOptions && isInModal && (
          <ModalPortal>
            <OptionGroup
              className={className}
              value={value}
              addOptionAble={addOptionAble}
              component={component}
              isShowSelected={this.props.isShowSelected}
              position={this.selector.getBoundingClientRect()}
              isInModal={isInModal}
              top={this.getSelectedOptionTop()}
              options={options}
              onChange={this.props.onChange}
              searchable={searchable}
              searchPlaceholder={searchPlaceholder}
              noOptionsPlaceholder={noOptionsPlaceholder}
              onClickOutside={this.onClick}
              closeSelect={this.closeSelect}
              getFilterOptions={this.getFilterOptions}
              supportMultipleSelect={this.props.supportMultipleSelect}
            />
          </ModalPortal>
        )}
      </div>
    );
  }
}

CustomizeSelect.propTypes = {
  className: PropTypes.string,
  value: PropTypes.object,
  options: PropTypes.array,
  placeholder: PropTypes.string,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  searchable: PropTypes.bool,
  addOptionAble: PropTypes.bool,
  searchPlaceholder: PropTypes.string,
  noOptionsPlaceholder: PropTypes.string,
  component: PropTypes.object,
  supportMultipleSelect: PropTypes.bool,
  isShowSelected: PropTypes.bool,
  isInModal: PropTypes.bool, // if select component in a modal (option group need ModalPortal to show)
};

export default CustomizeSelect;
