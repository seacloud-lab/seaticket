import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import OptGroup from './option-group';
import ModalPortal from '../../../components/modal-portal';

import '../../css/select/index.css';

class Select extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowSelectOptions: false
    };
  }

  componentDidMount() {
    document.addEventListener('click', this.onClick);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.onClick);
  }

  onSelectToggle = (event) => {
    event.preventDefault();
    /*
      if select is showing, click events do not need to be monitored by other click events,
      so it can be closed when other select is clicked.
    */
    if (this.state.isShowSelectOptions) event.nativeEvent.stopImmediatePropagation();
    let eventClassName = event.target.className;
    if (this.props.isLocked || eventClassName.indexOf('option-search-control') > -1 || eventClassName === 'option-group-search') return;
    //Prevent closing by pressing the spacebar in the search input 
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
    this.setState({isShowSelectOptions: false});
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
      const { value, name } = option;
      if (typeof name === 'string') {
        return name.toLowerCase().indexOf(validSearchVal) > -1;
      }
      if (typeof value === 'object') {
        return value.columnOption && value.columnOption.name.toLowerCase().indexOf(validSearchVal) > -1;
      }
      return false;
    });
  };

  renderSelectOptions = () => {
    if (!this.state.isShowSelectOptions) return null;
    const { value, options, searchable, searchPlaceholder, noOptionsPlaceholder, addOptionAble, isShowSelected,
      component, isInModal, supportMultipleSelect } = this.props;
    if (isInModal) {
      return (
        <ModalPortal>
          <OptGroup
            searchable={searchable}
            isShowSelected={isShowSelected}
            addOptionAble={addOptionAble}
            supportMultipleSelect={supportMultipleSelect}
            value={value}
            isInModal={isInModal}
            top={this.getSelectedOptionTop()}
            position={this.selector.getBoundingClientRect()}
            options={options}
            onSelectOption={this.props.onSelectOption}
            searchPlaceholder={searchPlaceholder}
            noOptionsPlaceholder={noOptionsPlaceholder}
            component={component}
            closeSelect={this.closeSelect}
            getFilterOptions={this.getFilterOptions}
          />
        </ModalPortal>
      );
    }
    return (
      <OptGroup
        searchable={searchable}
        isShowSelected={isShowSelected}
        addOptionAble={addOptionAble}
        supportMultipleSelect={supportMultipleSelect}
        isInModal={isInModal}
        value={value}
        top={this.getSelectedOptionTop()}
        position={this.selector.getBoundingClientRect()}
        options={options}
        onSelectOption={this.props.onSelectOption}
        searchPlaceholder={searchPlaceholder}
        noOptionsPlaceholder={noOptionsPlaceholder}
        component={component}
        closeSelect={this.closeSelect}
        getFilterOptions={this.getFilterOptions}
      />
    );
  };

  render() {
    const { className, value, placeholder, isLocked } = this.props;
    return(
      <div
        ref={(node) => this.selector = node}
        className={classnames('dtable-select custom-select', 
          {'focus': this.state.isShowSelectOptions},
          {'disabled': isLocked},
          className
        )} 
        onClick={this.onSelectToggle}>
        <div className="selected-option">
          {value && value.label ? (
            <span className="selected-option-show">{value.label}</span>
          ) : (
            <span className="select-placeholder">{placeholder}</span>
          )}
          {!isLocked && <i className="dtable-font dtable-icon-down3 ml-2"></i>}
        </div>
        {this.renderSelectOptions()}
      </div>
    );
  }
}

Select.propTypes = {
  isLocked: PropTypes.bool,
  searchable: PropTypes.bool,
  addOptionAble: PropTypes.bool,
  supportMultipleSelect: PropTypes.bool,
  isShowSelected: PropTypes.bool,
  isInModal: PropTypes.bool, // if select component in a modal (option group need ModalPortal to show)
  className: PropTypes.string,
  value: PropTypes.object,
  options: PropTypes.array,
  placeholder: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  noOptionsPlaceholder: PropTypes.string,
  component: PropTypes.object,
  onSelectOption: PropTypes.func,
};

export default Select;
