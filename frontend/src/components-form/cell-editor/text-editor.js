import React from 'react';
import PropTypes from 'prop-types';
import TextEditorDropdown from '../cell-editor-widgets/text-editor-dropdown';

import '../cell-css/text-editor.css';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  column: PropTypes.object,
};

class TextEditor extends React.Component {
  render() {
    const { isReadOnly, value } = this.props;
    const validValue = value || '';
    return (
      <div className="cell-editor grid-cell-type-text">
        <div className="text-editor-container">
          {isReadOnly ?
            <div className="form-control text-truncate readOnly" title={validValue}>{validValue}</div>
            :
            <TextEditorDropdown {...this.props}/>
          }
        </div>
      </div>
    );
  }
}

TextEditor.propTypes = propTypes;

export default TextEditor;
