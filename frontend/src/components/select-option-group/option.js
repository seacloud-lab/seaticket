import React, { Component } from 'react';
import PropTypes from 'prop-types';

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
    return (
      <div
        className={this.props.isActive ? 'option option-active' : 'option'}
        onClick={this.onChange.bind(this, this.props.value)}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >{this.props.children}
      </div>
    );
  }
}

Option.propTypes = {
  index: PropTypes.number,
  isActive: PropTypes.bool,
  changeIndex: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.string]),
  onChange: PropTypes.func,
  supportMultipleSelect: PropTypes.bool,
  disableHover: PropTypes.bool,
};

export default Option;
