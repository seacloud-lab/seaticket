import React from 'react';
import PropTypes from 'prop-types';
import SelectOption from '../cell-formatter-widgets/select-option';

const propTypes = {
  value: PropTypes.string,
  column: PropTypes.object,
};

class SingleSelectFormatter extends React.Component {

  render() {
    let { value, column } = this.props;
    return (
      <div className="cell-formatter grid-cell-type-single-select"><SelectOption value={value} column={column} /></div>
    );
  }
}

SingleSelectFormatter.propTypes = propTypes;

export default SingleSelectFormatter;
