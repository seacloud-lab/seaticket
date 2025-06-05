import React, { Component } from 'react';
import PropTypes from 'prop-types';
import DurationEditorDropdown from '../cell-editor-widgets/duration-editor-dropdown';
import { getDurationDisplayString } from 'dtable-utils';

import '../cell-css/text-editor.css';

const propTypes = {
  isReadOnly: PropTypes.bool,
  column: PropTypes.object,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

class DurationEditor extends Component {

  renderEditor = () => {
    const { isReadOnly, value, column } = this.props;
    if (isReadOnly) {
      const validValue = value || '';
      const durationDisplayString = getDurationDisplayString(validValue, column?.data);
      return (
        <div
          className="form-control text-truncate readOnly"
          title={durationDisplayString}
        >
          {durationDisplayString}
        </div>
      );
    }
    return <DurationEditorDropdown {...this.props}/>;
  };

  render() {
    return (
      <div className="cell-editor grid-cell-type-text">
        <div className="text-editor-container">
          {this.renderEditor()}
        </div>
      </div>
    );
  }

}

DurationEditor.propTypes = propTypes;

export default DurationEditor;
