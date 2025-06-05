import React, { Component } from 'react';
import PropTypes from 'prop-types';
import SettingWorkflowReadOnlyRowItem from '../common/setting-workflow-readonly-row-item';

class ReadOnlyColumnsContainer extends Component {

  moveItem = (optionSource, optionTarget) => {
    const { workflowConfig, selectedNode, currentColumns } = this.props;
    const { node_form } = selectedNode;
    const { nodes } = workflowConfig;
    const nodeIndex = nodes.findIndex(node => node._id === selectedNode._id);
    let newNodeForm = { ...node_form };
    let newNodes = nodes.slice(0);
    const readOnlyColumns = newNodeForm.readonly_columns.filter(column => {
      return currentColumns.findIndex(col => col.key === column.key) > -1;
    });
    const sourceData = readOnlyColumns[optionSource.idx];
    readOnlyColumns.splice(optionSource.idx, 1);
    readOnlyColumns.splice(optionTarget.idx, 0, sourceData);
    newNodeForm.readonly_columns = readOnlyColumns;
    const newNode = { ...selectedNode, node_form: newNodeForm };
    newNodes[nodeIndex] = newNode;
    const newWorkflowConfig = { ...workflowConfig, nodes: newNodes };
    this.props.updateWorkflowConfig(newWorkflowConfig);
  };

  render() {
    const { editorConfig, currentColumns, readOnlyColumns } = this.props;

    return (
      <div className="readonly-columns">
        {readOnlyColumns.map((column, index) => {
          return (
            <SettingWorkflowReadOnlyRowItem
              key={column.key}
              index={index}
              column={column}
              currentColumns={currentColumns}
              editorConfig={editorConfig}
              moveItem={this.moveItem}
            />
          );
        })}
      </div>
    );
  }
}

ReadOnlyColumnsContainer.propTypes = {
  readOnlyColumns: PropTypes.array,
  currentColumns: PropTypes.array,
  editorConfig: PropTypes.object,
  workflowConfig: PropTypes.object,
  selectedNode: PropTypes.object,
  updateWorkflowConfig: PropTypes.func,
};

export default ReadOnlyColumnsContainer;
