import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import ClickOutside from '@/components/click-outside';
import Editor from './editor';
import { isFunction } from '@/utils/type-detection';
import { EDITOR_CONTAINER as Z_INDEX_EDITOR_CONTAINER } from '../../../../constants/z-index';
import eventBus from '@/utils/event-bus';
import { getColumnOriginName } from '../../../../utils/column';
import { getCellValueByColumn, isCellValueChanged, isValidCellValue } from '../../../../utils/cell';
import { EVENT_BUS_TYPE } from '../../../../constants/event-bus-type';

class PopupEditorContainer extends React.Component {

  static displayName = 'PopupEditorContainer';

  constructor(props) {
    super(props);
    const { width, height, left, top } = this.props;
    this.state = {
      isInvalid: false,
      style: {
        position: 'absolute',
        zIndex: Z_INDEX_EDITOR_CONTAINER,
        left,
        top,
        width,
        height,
      }
    };
    this.isClosed = false;
    this.changeCanceled = false;
  }

  changeCommitted = false;
  changeCanceled = false;
  editingRowId = this.props.row._id;

  componentDidUpdate(prevProps) {
    if (prevProps.scrollLeft !== this.props.scrollLeft || prevProps.scrollTop !== this.props.scrollTop) {
      this.commitCancel();
    }
  }

  componentWillUnmount() {
    if (!this.changeCommitted && !this.changeCanceled) {
      this.commit();
    }
  }

  setEditorRef = (editor) => {
    this.editor = editor;
  };

  createEditor = () => {
    const { column, row, height, onPressTab, editorPosition, columns, modifyColumnData, readOnly, operation } = this.props;
    const value = this.getInitialValue();

    let editorProps = {
      value: value,
      rowMetaData: this.getRowMetaData(),
      onBlur: this.commit,
      onCommit: this.commit,
      onCommitData: this.commitData,
      onCommitCancel: this.commitCancel,
      onClose: this.closeEditor,
      onEscape: this.closeEditor,
      editorContainer: document.body,
      modifyColumnData,
      editorPosition,
      editingRowId: this.editingRowId,
      row,
      height,
      columns,
      column,
      readOnly,
      onPressTab,
      operation,
    };

    return (
      <Editor column={column} editorProps={editorProps} ref={this.setEditorRef} />
    );
  };

  getRowMetaData = () => {
    // clone row data so editor cannot actually change this
    // convention based method to get corresponding Id or Name of any Name or Id property
    if (typeof this.props.column.getRowMetaData === 'function') {
      const { row, column } = this.props;
      return this.props.column.getRowMetaData(row, column);
    }
  };

  getEditor = () => {
    return this.editor;
  };

  getInitialValue = () => {
    const { firstEditorKeyDown: key, value } = this.props;
    if (key === 'Enter') {
      return value;
    }
    return key || value;
  };

  getOldRowData = (originalOldCellValue) => {
    const { column } = this.props;
    const columnName = getColumnOriginName(column);
    const { key: columnKey } = column;
    let oldValue = originalOldCellValue;
    if (this.getEditor() && this.getEditor().getOldValue) {
      const original = this.getEditor().getOldValue();
      oldValue = original[Object.keys(original)[0]];
    }
    const oldRowData = { [columnName]: oldValue };
    const originalOldRowData = { [columnKey]: originalOldCellValue }; // { [column.key]: cellValue }
    return { oldRowData, originalOldRowData };
  };

  // The input area in the interface loses focus. Use this.getEditor().getValue() to get data.
  commit = (closeEditor) => {
    const { row } = this.props;
    if (!row || !row._id) return;
    const updated = (this.getEditor() && this.getEditor().getValue()) || {};
    this.commitData(updated, closeEditor);
  };

  // This is the updated data obtained by manually clicking the button
  commitData = (updated, closeEditor = false) => {
    const { onCommit, column, row } = this.props;
    const { key: columnKey, name: columnName } = column;
    const originalOldCellValue = getCellValueByColumn(row, column);
    let originalUpdates = { ...updated };
    if (!isCellValueChanged(originalOldCellValue, originalUpdates[columnKey]) || !this.isNewValueValid(updated)) {
      if (closeEditor && typeof this.editor.onClose === 'function') {
        this.editor.onClose();
      }
      return;
    }

    const rowId = row._id;
    const key = Object.keys(updated)[0];
    const value = updated[key];
    if (column.is_required && !isValidCellValue(value, column)) {
      this.commitCancel();
      return;
    }

    this.changeCommitted = true;
    const updates = { [columnName]: value };
    const { oldRowData, originalOldRowData } = this.getOldRowData(originalOldCellValue);

    // updates used for update remote row data
    // originalUpdates used for update local row data
    // oldRowData ues for undo/undo modify row
    // originalOldRowData ues for undo/undo modify row
    onCommit({ rowId, cellKey: columnKey, updates, originalUpdates, oldRowData, originalOldRowData }, closeEditor);
  };

  commitCancel = () => {
    this.changeCanceled = true;
    this.props.onCommitCancel();
  };

  isNewValueValid = (value) => {
    if (this.getEditor() && isFunction(this.getEditor().validate)) {
      const isValid = this.getEditor().validate(value);
      this.setState({ isInvalid: !isValid });
      return isValid;
    }
    return true;
  };

  handleRightClick = (e) => {
    e.stopPropagation();
  };

  closeEditor = (isEscapeKeydown) => {
    !this.isClosed && this.onClickOutside(isEscapeKeydown);
  };

  onClickOutside = (isEscapeKeydown) => {
    this.isClosed = true;
    this.commit();
    this.props.onCommitCancel();
    !isEscapeKeydown && eventBus.dispatch(EVENT_BUS_TYPE.SELECT_NONE);
  };

  render() {
    return (
      <ClickOutside onClickOutside={this.onClickOutside}>
        <div
          style={this.state.style}
          className={classnames({ 'has-error': this.state.isInvalid === true })}
          onContextMenu={this.handleRightClick}
          ref={this.props.innerRef}
        >
          {this.createEditor()}
        </div>
      </ClickOutside>
    );
  }
}

PopupEditorContainer.propTypes = {
  firstEditorKeyDown: PropTypes.string,
  openEditorMode: PropTypes.string,
  columns: PropTypes.array,

  // position info
  editorPosition: PropTypes.object,
  width: PropTypes.number,
  height: PropTypes.number,
  left: PropTypes.number,
  top: PropTypes.number,
  scrollLeft: PropTypes.number,
  scrollTop: PropTypes.number,

  row: PropTypes.object,
  column: PropTypes.object,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object, PropTypes.bool, PropTypes.array]),

  onGridKeyDown: PropTypes.func,
  onCommit: PropTypes.func,
  onCommitCancel: PropTypes.func,
  innerRef: PropTypes.func,
  onPressTab: PropTypes.func,
};

export default PopupEditorContainer;
