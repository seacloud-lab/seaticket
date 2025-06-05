import React from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { nodeFactory } from '../utils/utils';
import { gettext } from '../../utils/constants';
import { NODE_TYPE } from '../constants';
import WorkflowChart from './workflow-chart';

import '../css/workflow-process.css';

class WorkflowProcess extends React.Component {

  updateNodes = (newNodes, selectedNode) => {
    const { workflowConfig } = this.props;
    newNodes = newNodes.filter(node => {
      if (!workflowConfig.can_cancel_task && node.type === NODE_TYPE.CANCELED) {
        return false;
      }
      return true;
    });
    const newWorkflowConfig = {
      ...workflowConfig,
      nodes: newNodes
    };
    this.props.updateWorkflowConfig(newWorkflowConfig);
    selectedNode && this.props.setSelectedNode(selectedNode);
  };

  addNode = (event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    const { nodes } = this.props;
    let newNodes = nodes.slice(0);
    const nodeCount = newNodes.length;
    const nodeName = `${gettext('Node')} ${nodeCount - 1}`;
    const newNode = nodeFactory('normal', nodeName, { nodes });
    newNodes.push(newNode);
    this.updateNodes(newNodes, newNode);
  };

  onCopyNode = (copiedNode) => {
    const { nodes } = this.props;
    const copiedNodeIndex = nodes.findIndex(node => node._id === copiedNode._id);
    if (copiedNodeIndex === -1) return;
    let newNodes = nodes.slice(0);
    const nodeName = copiedNode.name + `(${gettext('Copy')})`;
    const copyNode = nodeFactory('copy', nodeName, { nodes, copiedNode });
    newNodes.push(copyNode);
    this.updateNodes(newNodes, copyNode);
  };

  onAddWorkflowNode = (line) => {
    const { nodes } = this.props;
    const startNode = nodes.find(node => node._id === line.from);
    const endNode = nodes.find(node => node._id === line.to);
    if (!startNode || !endNode) {
      toaster.danger(gettext('Add node failed'));
      return;
    }
    let newNodes = nodes.slice(0);
    const { readonly_columns = [], readwrite_columns = [] } = startNode.node_form;
    const nodeCount = newNodes.length;
    const addedNodeName = `${gettext('Node')} ${nodeCount - 1}`;
    let addedNode = nodeFactory(NODE_TYPE.NORMAL, addedNodeName, { nodes, nextNode: endNode });
    addedNode.node_form = {
      readonly_columns: [...readonly_columns, ...readwrite_columns],
      readwrite_columns: []
    };
    const startNodeIndex = newNodes.findIndex(node => node._id === line.from);
    newNodes[startNodeIndex] = {
      ...startNode,
      next_node_id: startNode.next_node_id === line.to ? addedNode._id : startNode.next_node_id,
      conditional_next_nodes: startNode.conditional_next_nodes ? startNode.conditional_next_nodes.map(item => {
        return {
          ...item,
          next_node_id: item.next_node_id === line.to ? addedNode._id : item.next_node_id,
        };
      }) : [],
    };
    newNodes.push(addedNode);
    this.updateNodes(newNodes, addedNode);
  };

  onDeleteNode = (deletedNode) => {
    if (!deletedNode) return;
    const { nodes } = this.props;
    const deletedNodeId = deletedNode._id;
    if (deletedNode.type === NODE_TYPE.INIT || deletedNode.type === NODE_TYPE.COMPLETED || deletedNode.type === NODE_TYPE.CANCELED) return;
    const deletedNodeIndex = nodes.findIndex(node => node._id === deletedNodeId);
    if (deletedNodeIndex === -1) return;
    let newNodes = nodes.slice(0);
    newNodes.splice(deletedNodeIndex, 1);
    this.updateNodes(newNodes);
  };

  onUpdateNode = (updateNode) => {
    if (!updateNode) return;
    const { nodes } = this.props;
    let newNodes = nodes.slice(0);
    const updateNodeIndex = newNodes.findIndex(node => node._id === updateNode._id);
    if (updateNodeIndex === -1) return;
    newNodes[updateNodeIndex] = updateNode;
    this.updateNodes(newNodes);
  };

  render() {
    const { selectedNode, nodes, workflowConfig, workflowRelatedUsers } = this.props;
    return (
      <>
        <div className="workflow-nodes-title text-truncate">{gettext('Workflow design')}</div>
        <WorkflowChart
          selectedNode={selectedNode}
          workflowRelatedUsers={workflowRelatedUsers}
          nodes={nodes}
          workflowConfig={workflowConfig}
          addComponent={
            <>
              <div className="workflow-add-node btn btn-secondary text-truncate" onClick={this.addNode}>
                <i className="dtable-font dtable-icon-add-table workflow-add-node-icon mr-2"></i>
                {gettext('Add node')}
              </div>
            </>
          }
          onAddNode={this.onAddWorkflowNode}
          onDeleteNode={this.onDeleteNode}
          onUpdateNode={this.onUpdateNode}
          onCopyNode={this.onCopyNode}
          setSelectedNode={this.props.setSelectedNode}
        />
      </>
    );
  }
}

WorkflowProcess.propTypes = {
  workflowConfig: PropTypes.object,
  nodes: PropTypes.array,
  selectedNode: PropTypes.object,
  updateWorkflowConfig: PropTypes.func,
  setSelectedNode: PropTypes.func,
  workflowRelatedUsers: PropTypes.array,
};

export default WorkflowProcess;
