import React from 'react';
import PropTypes from 'prop-types';
import SelectOption from '../cell-formatter-widgets/select-option';

const propTypes = {
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  column: PropTypes.object,
};

class MultipleSelectFormatter extends React.Component {

  render() {
    let { value, column } = this.props;
    return (
      <div className="cell-formatter grid-cell-type-multiple-select">
        {value && Array.isArray(value) && value.map((item, index) => {
          return (<SelectOption key={index} value={item} column={column} />);
        })}
      </div>
    );
  }
}

MultipleSelectFormatter.propTypes = propTypes;

export default MultipleSelectFormatter;
