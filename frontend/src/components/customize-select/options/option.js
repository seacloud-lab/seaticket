import React, { Component } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { IconButton } from '@/components';

class Option extends Component {

  onChange = (value, event) => {
    if (this.props.supportMultipleSelect) {
      event.stopPropagation();
    }
    this.props.onChange(value, event);
  };

  onMouseEnter = () => {
    if (!this.props.disableHover) {
      this.props.changeIndex(this.props.index);
    }
  };

  onMouseLeave = () => {
    if (!this.props.disableHover) {
      this.props.changeIndex(-1);
    }
  };

  render() {
    const { isSelected } = this.props;
    return (
      <div
        className={classnames('seaqa-select-option', { 'active': this.props.isActive })}
        onClick={this.onChange.bind(this, this.props.value)}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >
        <div className="seaqa-select-option-content d-flex align-items-center flex-1 text-truncate">
          {this.props.children}
        </div>
        <IconButton icon={isSelected ? 'check-mark-option' : ''} size={14} className="seaqa-select-option-check-btn no-hover-bg" />
      </div>
    );
  }
}

Option.propTypes = {
  index: PropTypes.number,
  isActive: PropTypes.bool,
  isSelected: PropTypes.bool,
  changeIndex: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.string]),
  onChange: PropTypes.func,
  supportMultipleSelect: PropTypes.bool,
  disableHover: PropTypes.bool,
};

export default Option;
