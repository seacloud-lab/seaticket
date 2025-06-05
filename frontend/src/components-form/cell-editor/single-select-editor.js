import React from 'react';
import PropTypes from 'prop-types';
import { CellType } from 'dtable-utils';
import { OPTIONS_SHOW_TYPE } from '../../constants/form-constants';
import SingleSelectListEditor from '../cell-editor-widgets/single-select-editor/single-select-list-editor';
import SingleSelectDropdownEditor from '../cell-editor-widgets/single-select-editor/single-select-dropdown-editor';

import '../cell-css/select-editor.css';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  isEditorShow: PropTypes.bool,
  value: PropTypes.string,
  column: PropTypes.object,
  row: PropTypes.object,
  columns: PropTypes.array,
  onCommit: PropTypes.func,
  updateTabIndex: PropTypes.func,
};

class SingleSelectEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    isSubmitting: false,
    value: ''
  };

  constructor(props) {
    super(props);
    this.state = {
      value: props.value
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.value !== this.state.value) {
      this.setState({ value: nextProps.value });
    }
  }

  onCommit = (newValue) => {
    const { column: { key: currentColumnKey } } = this.props;
    const updated = this.handleCascadeColumn(newValue, currentColumnKey);
    updated[currentColumnKey] = newValue;
    this.setState({ value: newValue }, () => {
      this.props.onCommit(updated);
    });
  };

  handleCascadeColumn = (optionValue, currentColumnKey, updated = {}, processedColumns = new Set()) => {
    // This column has already been processed, avoid circular dependency.
    if (processedColumns.has(currentColumnKey)) {
      return updated;
    }
    processedColumns.add(currentColumnKey);
    const { columns, row } = this.props;
    const singleSelectColumns = columns.filter(column => column.type === CellType.SINGLE_SELECT);
    for (let i = 0; i < singleSelectColumns.length; i++) {
      const singleSelectColumn = singleSelectColumns[i];
      const { data } = singleSelectColumn;
      if (!data) continue;
      const { cascade_column_key = '', cascade_settings = {} } = data;
      if (cascade_column_key === currentColumnKey) {
        const { key: childColumnKey } = singleSelectColumn;
        const childColumnOptions = cascade_settings[optionValue];
        const childColumnCellValue = row[childColumnKey];
        const cellValueInOptions = childColumnOptions && childColumnOptions.includes(childColumnCellValue);
        if (!cellValueInOptions) {
          updated[childColumnKey] = '';
          this.handleCascadeColumn('', childColumnKey, updated, processedColumns);
        }
      }
    }
    return updated;
  };

  getOptions = () => {
    const { column, row, columns } = this.props;
    const { data } = column || {};
    const { cascade_column_key, cascade_settings, options } = data || {};
    let validOptions = options || [];
    if (cascade_column_key) {
      const cascadeColumn = columns.find(column => column.key === cascade_column_key);
      if (cascadeColumn) {
        const cascadeColumnValue = row[cascade_column_key];
        if (!cascadeColumnValue) return [];
        const cascadeSetting = cascade_settings[cascadeColumnValue];
        if (!cascadeSetting || !Array.isArray(cascadeSetting) || cascadeSetting.length === 0) return [];
        validOptions = validOptions.filter(option => cascadeSetting.includes(option.id));
      }
    }
    return validOptions;
  };

  render() {
    const { column } = this.props;
    const { options_show_type } = column;
    const editorProps = {
      ...this.props,
      onCommit: this.onCommit,
      value: this.state.value,
      getOptions: this.getOptions,
    };
    if (options_show_type === OPTIONS_SHOW_TYPE.LIST) {
      return <SingleSelectListEditor {...editorProps} />;
    }
    return <SingleSelectDropdownEditor {...editorProps} />;
  }
}

SingleSelectEditor.propTypes = propTypes;

export default SingleSelectEditor;
