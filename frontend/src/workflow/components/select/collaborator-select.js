import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { searchCollaborators } from 'dtable-utils';
import DTablePopover from '../../../components/dtable-popover';
import OptGroup from './option-group';

import '../../css/collaborator-select.css';

class CollaboratorSelect extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isShowSelectOptions: false
    };
    this.id = 'collaborator-select-' + Math.trunc(Math.random() * 10000);
  }

  static defaultProps = {
    top: -3,
    left: -3,
  };

  componentDidMount() {
    if (!this.props.isUsePopover) {
      document.addEventListener('click', this.onClick);
    }
    this.btnWidth = this.selector.clientWidth;
  }

  componentWillUnmount() {
    if (!this.props.isUsePopover) {
      document.removeEventListener('click', this.onClick);
    }
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
    // Prevent closing by pressing the spacebar in the search input
    if (event.target.value === '') return;
    this.selectedOptionWidth = this.selectedOptionRef.clientWidth;
    this.setState({
      isShowSelectOptions: !this.state.isShowSelectOptions
    });
  };

  onClick = (event) => {
    const target = event.target;
    const name = target.className;
    const { isShowSelectOptions } = this.state;
    if (!isShowSelectOptions || name === 'select-placeholder' || name.includes('icon-fork-number') || this.selector.contains(target)) {
      return;
    }
    const { isUsePopover } = this.props;
    if ((isUsePopover && !this.collaboratorSelectPopoverRef.contains(target))
    || (!isUsePopover && !this.selector.contains(target))) {
      this.closeSelect();
    }
  };

  closeSelect = () => {
    this.setState({ isShowSelectOptions: false });
  };

  getFilterOptions = (searchValue) => {
    const { options, searchable } = this.props;
    if (!searchable) return options || [];
    return searchCollaborators(options, searchValue);
  };

  renderOptionGroup = () => {
    const { value, options, searchable, searchPlaceholder, noOptionsPlaceholder, top, left,
      isUsePopover } = this.props;
    if (!isUsePopover) {
      return (
        <OptGroup
          value={value}
          top={top}
          left={left}
          minWidth={this.btnWidth + 8} // 8px is padding
          options={options}
          onSelectOption={this.props.onSelectOption}
          searchable={searchable}
          searchPlaceholder={searchPlaceholder}
          noOptionsPlaceholder={noOptionsPlaceholder}
          closeSelect={this.closeSelect}
          getFilterOptions={this.getFilterOptions}
          supportMultipleSelect={this.props.supportMultipleSelect}
          stopClickEvent={true}
          isShowSelected={true}
        />
      );
    }
    return (
      <DTablePopover
        target={this.id}
        placement="bottom-start"
        popoverClassName="collaborator-select-popover dtable-select"
        hideDTablePopover={this.closeSelect}
        hideDTablePopoverWithEsc={this.closeSelect}
      >
        <div ref={ref => this.collaboratorSelectPopoverRef = ref}>
          <OptGroup
            value={value}
            top={top}
            left={left}
            minWidth={this.btnWidth + 8} // 8px is padding
            options={options}
            onSelectOption={this.props.onSelectOption}
            searchable={searchable}
            searchPlaceholder={searchPlaceholder}
            noOptionsPlaceholder={noOptionsPlaceholder}
            closeSelect={this.closeSelect}
            getFilterOptions={this.getFilterOptions}
            supportMultipleSelect={this.props.supportMultipleSelect}
            stopClickEvent={false}
            isShowSelected={true}
          />
        </div>
      </DTablePopover>
    );
  };

  render() {
    let { className, value, placeholder, isLocked } = this.props;
    const { isShowSelectOptions } = this.state;
    return (
      <button
        ref={(node) => this.selector = node}
        className={classnames('dtable-select custom-select collaborator-select',
          { 'focus': isShowSelectOptions },
          { 'disabled': isLocked },
          className
        )}
        id={this.id}
        onClick={this.onSelectToggle}
      >
        <div className="selected-option" ref={node => this.selectedOptionRef = node} >
          {value.label ?
            <span className="selected-option-show">{value.label}</span>
            :
            <span className="select-placeholder">{placeholder}</span>
          }
          {!isLocked && <i className="dtable-font dtable-icon-down3"></i>}
        </div>
        {isShowSelectOptions && this.renderOptionGroup()}
      </button>
    );
  }
}

CollaboratorSelect.propTypes = {
  className: PropTypes.string,
  value: PropTypes.object,
  options: PropTypes.array,
  placeholder: PropTypes.string,
  isLocked: PropTypes.bool,
  searchable: PropTypes.bool,
  searchPlaceholder: PropTypes.string,
  noOptionsPlaceholder: PropTypes.string,
  supportMultipleSelect: PropTypes.bool,
  isUsePopover: PropTypes.bool,
  top: PropTypes.number,
  left: PropTypes.number,
  onSelectOption: PropTypes.func,
};

export default CollaboratorSelect;
