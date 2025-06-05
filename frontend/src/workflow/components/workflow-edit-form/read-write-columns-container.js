import React, { Component } from 'react';
import PropTypes from 'prop-types';
import SettingWorkflowRowItem from '../common/setting-workflow-row-item';

class ReadWriteColumnsContainer extends Component {

  moveItem = (optionSource, optionTarget) => {
    const { workflowConfig, selectedNode, currentColumns } = this.props;
    const { node_form } = selectedNode;
    const { nodes } = workflowConfig;
    const nodeIndex = nodes.findIndex(node => node._id === selectedNode._id);
    let newNodeForm = { ...node_form };
    let newNodes = nodes.slice(0);
    const readWriteColumns = newNodeForm.readwrite_columns.filter(column => {
      return currentColumns.findIndex(col => col.key === column.key) > -1;
    });
    const sourceData = readWriteColumns[optionSource.idx];
    readWriteColumns.splice(optionSource.idx, 1);
    readWriteColumns.splice(optionTarget.idx, 0, sourceData);
    newNodeForm.readwrite_columns = readWriteColumns;
    const newNode = { ...selectedNode, node_form: newNodeForm };
    newNodes[nodeIndex] = newNode;
    const newWorkflowConfig = { ...workflowConfig, nodes: newNodes };
    this.props.updateWorkflowConfig(newWorkflowConfig);
  };

  render() {
    const { currentColumns, readWriteColumns, editingColumnIdx, editorConfig,
      onColumnChanged, setEditingColumnIdx } = this.props;

    return (
      readWriteColumns.map((column, index) => {
        const columnIndex = currentColumns.findIndex(col => col.key === column.key);
        return (
          <SettingWorkflowRowItem
            key={column.key}
            index={index}
            isEditing={editingColumnIdx === columnIndex}
            column={column}
            currentColumns={currentColumns}
            editorConfig={editorConfig}
            onColumnChanged={onColumnChanged}
            setEditingColumnIdx={() => setEditingColumnIdx(columnIndex)}
            moveItem={this.moveItem}
          />
        );
      })
    );
  }
}

ReadWriteColumnsContainer.propTypes = {
  editingColumnIdx: PropTypes.number,
  currentColumns: PropTypes.array,
  readWriteColumns: PropTypes.array,
  editorConfig: PropTypes.object,
  workflowConfig: PropTypes.object,
  selectedNode: PropTypes.object,
  onColumnChanged: PropTypes.func,
  setEditingColumnIdx: PropTypes.func,
  updateWorkflowConfig: PropTypes.func,
};

export default ReadWriteColumnsContainer;
