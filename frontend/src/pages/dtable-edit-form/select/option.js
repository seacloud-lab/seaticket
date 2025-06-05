import React, { Component } from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  index: PropTypes.number,
  isActive: PropTypes.bool,
  changeIndex: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.string]),
  onSelectOption: PropTypes.func.isRequired,
  supportMultipleSelect: PropTypes.bool
};

class Option extends Component {
  constructor(props) {
    super(props);
  }

  onSelectOption = (value, event) => {
    this.props.onSelectOption(value, event);
  };

  onClick = (event) => {
    if (this.props.supportMultipleSelect) {
      event.stopPropagation();
    }
  };

  onMouseEnter = () => {
    if (this.props.changeIndex) {
      this.props.changeIndex(this.props.index);
    }
  };

  onMouseLeave = () => {
    if (this.props.changeIndex) {
      this.props.changeIndex(-1);
    }
  };

  render() {
    return(
      <div
        className={this.props.isActive ? 'option option-active' : 'option'}
        onMouseDown={this.onSelectOption.bind(this, this.props.value)}
        onClick={this.onClick}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >{this.props.children}</div>
    );
  }
}

Option.propTypes = propTypes;

export default Option;
