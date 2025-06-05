import React, { Component } from 'react';
import PropTypes from 'prop-types';
import EmailEditorDropdown from '../cell-editor-widgets/email-editor-dropdown';

const propTypes = {
  isReadOnly: PropTypes.bool,
  value: PropTypes.string,
};

class EmailEditor extends Component {

  renderEditor = () => {
    const { isReadOnly, value } = this.props;
    if (isReadOnly) {
      const validValue = value || '';
      return (
        <div
          className="form-control text-truncate readOnly"
          title={validValue}
        >
          {validValue}
        </div>
      );
    }
    return <EmailEditorDropdown {...this.props}/>;
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

EmailEditor.propTypes = propTypes;

export default EmailEditor;
