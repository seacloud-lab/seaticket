import React from 'react';
import PropTypes from 'prop-types';
import { OPTIONS_SHOW_TYPE } from '../../constants/form-constants';
import MultipleSelectListEditor from '../cell-editor-widgets/multiple-select-editor/multiple-select-list-editor';
import MultipleSelectDropdownEditor from '../cell-editor-widgets/multiple-select-editor/multiple-select-dropdown-editor';

import '../cell-css/select-editor.css';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  column: PropTypes.object,
  onCommit: PropTypes.func,
  isEditorShow: PropTypes.bool,
  updateTabIndex: PropTypes.func,
};

class MultipleSelectEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    isSubmitting: false,
    value: []
  };

  onCommit = (newValue) => {
    let { column } = this.props;
    let updated = { [column.key]: '' };
    if (newValue.length > 0) {
      updated[column.key] = newValue;
    }
    this.props.onCommit(updated);
  };

  render() {
    let { column } = this.props;
    let { options_show_type } = column;
    if (options_show_type === OPTIONS_SHOW_TYPE.LIST) {
      return <MultipleSelectListEditor {...this.props} onCommit={this.onCommit} />;
    }
    return <MultipleSelectDropdownEditor {...this.props} onCommit={this.onCommit} />;
  }
}

MultipleSelectEditor.propTypes = propTypes;

export default MultipleSelectEditor;
