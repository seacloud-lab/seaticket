import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Icon } from '@/components';

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
        className={classnames('seaqa-select-option option', { 'active': this.props.isActive })}
        onClick={this.onChange.bind(this, this.props.value)}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >
        <span className="option-content">{this.props.children}</span>
        {isSelected && <Icon symbol="check-mark" className="option-check-icon" />}
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
