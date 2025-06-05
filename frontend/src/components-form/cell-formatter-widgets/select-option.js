import React from 'react';
import PropTypes from 'prop-types';

import '../cell-css/select-option.css';

const propTypes = {
  value: PropTypes.string,
  column: PropTypes.object,
};

class SelectOption extends React.Component {

  getCurrentOption = () => {
    let { value, column } = this.props;
    let options = column.data.options;
    let option = options.find(item => { return item.id === value || item.name === value;});
    return option;
  };

  getStyle = () => {
    let option = this.getCurrentOption();
    let style = {
      backgroundColor: option.color,
      color: option.textColor || null,
    };
    return option ? style : null;
  };

  render() {
    let { value, column } = this.props;
    let currentOption = this.getCurrentOption();
    if (!value || !column.data || !column.data.options || !currentOption) {
      return (<div></div>);
    }

    let optionStyle = this.getStyle();
    return (<div style={optionStyle} className="select-option">{currentOption.name}</div>);
  }
}

SelectOption.propTypes = propTypes;

export default SelectOption;
