import React, { Component } from 'react';
import PropTypes from 'prop-types';

class SelectOption extends Component {
  constructor(props) {
    super(props);
  }

  onSelectOption = (value, event) => {
    if (this.props.supportMultipleSelect) {
      event.stopPropagation();
    }
    this.props.onSelectOption(value, event);
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
    const { isActive } = this.props;

    return (
      <div
        className={`option text-truncate pt-1 pb-1 ${isActive ? 'option-active' : ''}`}
        onClick={this.onSelectOption.bind(this, this.props.value)}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >{this.props.children}
      </div>
    );
  }
}

SelectOption.propTypes = {
  index: PropTypes.number,
  isActive: PropTypes.bool,
  changeIndex: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.string]),
  onSelectOption: PropTypes.func.isRequired,
  supportMultipleSelect: PropTypes.bool
};

export default SelectOption;
