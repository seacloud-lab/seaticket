import React, { Component } from 'react';
import OptGroup from './option-group';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Popover } from 'reactstrap';

import '../css/collaborator-select.css';

const propTypes = {
  className: PropTypes.string,
  value: PropTypes.object,
  options: PropTypes.array,
  placeholder: PropTypes.string,
  onSelectOption: PropTypes.func,
  isLocked: PropTypes.bool,
  searchable: PropTypes.bool,
  searchPlaceholder: PropTypes.string,
  noOptionsPlaceholder: PropTypes.string,
  supportMultipleSelect: PropTypes.bool,
  isUsePopover: PropTypes.bool,
  top: PropTypes.number,
  left: PropTypes.number,
};

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
    document.addEventListener('click', this.onClick);
    this.btnWidth = this.selector.clientWidth;
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
    this.selectedOptionWidth = this.selectedOptionRef.clientWidth;
    this.setState({
      isShowSelectOptions: !this.state.isShowSelectOptions
    });
  };

  onClick = (event) => {
    const name = event.target.className;
    if (name === 'select-placeholder' || name.includes('icon-fork-number')) {
      return;
    }
    if (!this.selector.contains(event.target)) {
      this.closeSelect();
    }
  };

  closeSelect = () => {
    this.setState({isShowSelectOptions: false});
  };

  renderOptionGroup = () => {
    let { value, options,searchable, searchPlaceholder, noOptionsPlaceholder, top, left, isUsePopover } = this.props;
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
          supportMultipleSelect={this.props.supportMultipleSelect}
          stopClickEvent={true}
          isShowSelected={true}
        />
      );
    }
    return (
      <Popover
        placement="bottom"
        isOpen={true}
        target={this.id}
        fade={false}
        hideArrow={true}
        className="collaborator-select-popover dtable-select"
      >
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
          supportMultipleSelect={this.props.supportMultipleSelect}
          stopClickEvent={true}
          isShowSelected={true}
        />
      </Popover>
    );
  };

  render() {
    let { className, value, placeholder, isLocked } = this.props;
    return(
      <button
        ref={(node) => this.selector = node}
        className={classnames('dtable-select custom-select collaborator-select', 
          {'focus': this.state.isShowSelectOptions},
          {'disabled': isLocked},
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
        {this.state.isShowSelectOptions && this.renderOptionGroup()}
      </button>
    );
  }
}

CollaboratorSelect.propTypes = propTypes;

export default CollaboratorSelect;
