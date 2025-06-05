import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import EditorConfig from './cell-editor/editor-config';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  isEditorShow: PropTypes.bool,
  isSupportPreview: PropTypes.bool,
  isEditFormPage: PropTypes.bool,
  apiUploadLinkName: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array, PropTypes.object, PropTypes.bool, PropTypes.number]),
  column: PropTypes.object,
  row: PropTypes.object,
  columns: PropTypes.array,
  onCommit: PropTypes.func.isRequired,
  onCommitCancel: PropTypes.func,
  updateTabIndex: PropTypes.func,
  getHistoryCommitByColumnKey: PropTypes.func,
  editorConfig: PropTypes.object,
};

class FormEditorGenerator extends React.Component {

  static defaultProps = {
    isReadOnly: false,
  };

  render() {
    const { isReadOnly, value, column, onCommit, onCommitCancel, isEditorShow, updateTabIndex, editorConfig, isEditFormPage,
      getHistoryCommitByColumnKey, isSubmitting, row, columns, apiUploadLinkName, isSupportPreview, useInlineEditor, isRequired } = this.props;
    const CellEditor = EditorConfig[column.type];
    const editorProps = {
      useInlineEditor,
      isReadOnly: isReadOnly,
      isSubmitting,
      isSupportPreview,
      apiUploadLinkName,
      value,
      column,
      row,
      columns,
      handleInputChange: onCommit,
      onCommit,
      onCommitCancel,
      isEditorShow,
      updateTabIndex,
      getHistoryCommitByColumnKey,
      editorConfig,
      isEditFormPage,
      isRequired
    };

    return (
      <Fragment>
        {CellEditor && React.cloneElement(CellEditor, { ...editorProps })}
      </Fragment>
    );
  }
}

FormEditorGenerator.propTypes = propTypes;

FormEditorGenerator.defaultProps = {
  useInlineEditor: false,
};

export default FormEditorGenerator;
