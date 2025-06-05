import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import FormatterConfig from './cell-formatter/formatter-config';

const propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array, PropTypes.bool, PropTypes.number, PropTypes.object]),
  column: PropTypes.object,
};

class FormatterGenerator extends React.Component {

  getCellFormatter = () => {
    let type = this.props.column.type;
    return FormatterConfig[type]
  };

  render() {
    
    let { value, column } = this.props;
    let CellFormatter = this.getCellFormatter();
    return (
      <Fragment>
        {CellFormatter && React.cloneElement(CellFormatter, { value, column })}
      </Fragment>
    );
  }
}

FormatterGenerator.propTypes = propTypes;

export default FormatterGenerator;
