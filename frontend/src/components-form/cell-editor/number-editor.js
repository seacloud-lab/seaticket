import React from 'react';
import PropTypes from 'prop-types';
import { getNumberDisplayString } from 'dtable-utils';
import NumberEditorDropdown from '../cell-editor-widgets/number-editor-dropdown';


const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  column: PropTypes.object,
};

class NumberEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    isSubmitting: false,
  };

  renderEditor = () => {
    const { isReadOnly, value, column } = this.props;
    let validValue = value;
    if (Object.prototype.toString.call(value) === '[object Number]') {
      validValue = getNumberDisplayString(value, column.data);
    }
    if (isReadOnly) {
      return (
        <div
          className="form-control text-truncate readOnly"
          title={validValue}
        >
          {validValue}
        </div>
      );
    }
    let propsObject = { ...this.props, value: validValue };
    return <NumberEditorDropdown {...propsObject}/>;
  };

  render() {
    return (
      <div className="cell-editor grid-cell-type-number">
        <div className="text-editor-container w-100">
          {this.renderEditor()}
        </div>
      </div>
    );
  }

}

NumberEditor.propTypes = propTypes;

export default NumberEditor;
