import React from 'react';
import PropTypes from 'prop-types';
import { getNumberDisplayString } from 'dtable-utils';

const propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  column: PropTypes.object,
};

class NumberFormatter extends React.Component {

  render() {
    const { value, column } = this.props;
    return (
      <div className="form-control cell-formatter grid-cell-type-number">
        {getNumberDisplayString(value, column.data)}
      </div>
    );
  }
}

NumberFormatter.propTypes = propTypes;

export default NumberFormatter;
