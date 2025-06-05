import React from 'react';
import PropTypes from 'prop-types';
import editorMap from './editor-map';

class WorkflowEditorGenerator extends React.Component {

  static defaultProps = {
    collaborators: [],
    isReadOnly: false,
    canViewFile: false
  };

  getCellEditor = () => {
    return editorMap[this.props.column.type];
  };

  render() {
    const { isReadOnly, value, column, onCommit, onCommitCancel, isEditorShow, updateTabIndex,
      getHistoryCommitByColumnKey, isSubmitting, row, columns, editorConfig, canViewFile,
      tables, table, workflowTaskId, collaborators, queryUsers, isSupportPreview, mode,
    } = this.props;
    const CellEditor = this.getCellEditor();
    const editorProps = {
      useInlineEditor: true,
      isReadOnly,
      isSubmitting,
      isSupportPreview,
      value,
      column,
      row,
      mode,
      columns,
      tables,
      table,
      editorConfig,
      handleInputChange: onCommit,
      onCommit,
      onCommitCancel,
      isEditorShow,
      updateTabIndex,
      getHistoryCommitByColumnKey,
      canViewFile,
      workflowTaskId,
      collaborators,
      queryUsers,
    };
    return (
      <>
        {CellEditor && React.cloneElement(CellEditor, { ...editorProps })}
      </>
    );
  }
}

WorkflowEditorGenerator.propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  isEditorShow: PropTypes.bool,
  isSupportPreview: PropTypes.bool,
  canViewFile: PropTypes.bool,
  workflowTaskId: PropTypes.number,
  mode: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array, PropTypes.object, PropTypes.bool, PropTypes.number]),
  column: PropTypes.object,
  row: PropTypes.object,
  columns: PropTypes.array,
  tables: PropTypes.array,
  table: PropTypes.object,
  editorConfig: PropTypes.object,
  onCommit: PropTypes.func.isRequired,
  onCommitCancel: PropTypes.func,
  updateTabIndex: PropTypes.func,
  getHistoryCommitByColumnKey: PropTypes.func,
  collaborators: PropTypes.array,
  queryUsers: PropTypes.func,
};

export default WorkflowEditorGenerator;
