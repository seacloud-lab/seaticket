import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { NODE_TYPE, NODE_HEIGHT_GAP, NODE_HEIGHT, NODE_WIDTH, NODE_WIDTH_GAP, NODE_DIRECTION } from '../../constants';
import { getWorkflowPathsAndLines } from '../../utils/workflow-node';
import WorkflowNode from './workflow-node';
import WorkflowEmptyNode from './workflow-empty-node';
import Line from './line';

class WorkflowNodeLRChart extends Component {

  renderPaths = (maxWidth, paths, lines) => {
    if (!Array.isArray(paths) || paths.length === 0) return null;
    const { readonly, selectedNode, workflowRelatedUsers } = this.props;
    const lastPathIdx = paths.length - 1;
    return (
      <>
        {paths.map((path, pathIdx) => {
          const lastPathNodeIdx = path.length - 1;
          return (
            <div
              key={`path_item_${pathIdx}`}
              className="path-item d-flex"
              style={{
                marginBottom: lastPathIdx === pathIdx ? 54 : NODE_HEIGHT_GAP,
                height: NODE_HEIGHT,
                width: maxWidth
              }}
            >
              {path.map((node, nodeIdx) => {
                const style = { marginRight: lastPathNodeIdx === nodeIdx ? 0 : NODE_WIDTH_GAP };
                if (!node) {
                  return (
                    <WorkflowEmptyNode key={`path_item_${pathIdx}_${nodeIdx}`} style={style} />
                  );
                }
                return (
                  <WorkflowNode
                    readonly={readonly}
                    key={node._id}
                    isSelectedNode={selectedNode && selectedNode._id === node._id}
                    currentNode={node}
                    style={style}
                    workflowRelatedUsers={workflowRelatedUsers}
                    setSelectedNode={this.props.setSelectedNode}
                    onCopyNode={this.props.onCopyNode}
                    onDeleteNode={this.props.onDeleteNode}
                    onUpdateNode={this.props.onUpdateNode}
                  />
                );
              })}
            </div>
          );
        })}
        <div className="workflow-path-lines">
          {this.renderLines(lines)}
        </div>
      </>
    );
  };

  renderLines = (lines) => {
    const { readonly, selectedNode } = this.props;
    if (!Array.isArray(lines) || lines.length === 0) return null;
    return lines.map(line => {
      return (
        <Line key={line.id} selectedNode={selectedNode} readonly={readonly} line={line} onAddNode={this.props.onAddNode} />
      );
    });
  };

  renderAddComponent = (maxWidth) => {
    const { addComponent } = this.props;
    if (!addComponent) return null;
    return (
      <div className="d-flex align-items-center" style={{ width: maxWidth, flexDirection: 'column' }}>
        {addComponent}
      </div>
    );
  };

  renderOtherNodes = (maxWidth, otherNodes) => {
    const { selectedNode, workflowConfig, workflowRelatedUsers, readonly } = this.props;
    const validOthers = Array.isArray(otherNodes) ? otherNodes : [];
    return (
      <div className="workflow-outside-nodes d-flex align-items-center" style={{ width: maxWidth }}>
        {validOthers.map(node => {
          if (!workflowConfig.can_cancel_task && node.type === NODE_TYPE.CANCELED) {
            return null;
          }
          return (
            <WorkflowNode
              readonly={readonly}
              key={node._id}
              isLastNode={true}
              style={{ marginBottom: 54 }}
              isSelectedNode={selectedNode && selectedNode._id === node._id}
              currentNode={node}
              workflowRelatedUsers={workflowRelatedUsers}
              setSelectedNode={this.props.setSelectedNode}
              onCopyNode={this.props.onCopyNode}
              onDeleteNode={this.props.onDeleteNode}
              onUpdateNode={this.props.onUpdateNode}
            />
          );
        })}
      </div>
    );
  };

  render() {
    const { nodes } = this.props;
    const { paths, lines, otherNodes } = getWorkflowPathsAndLines(nodes, NODE_DIRECTION.LR);
    let maxPathNodesCount = 0;
    paths.forEach(path => {
      if (path.length > maxPathNodesCount) {
        maxPathNodesCount = path.length;
      }
    });
    const maxWidth = (maxPathNodesCount - 1) * (NODE_WIDTH + NODE_WIDTH_GAP) + NODE_WIDTH;

    return (
      <div className="workflow-paths-container workflow-paths-LR-container w-100 p-4">
        <div className="workflow-paths-content position-relative" style={{ width: maxWidth }}>
          {this.renderPaths(maxWidth, paths, lines)}
          {this.renderOtherNodes(maxWidth, otherNodes)}
          {this.renderAddComponent(maxWidth)}
        </div>
      </div>
    );
  }
}

WorkflowNodeLRChart.defaultProps = {
  readonly: false,
  workflowConfig: {
    can_cancel_task: false,
  },
};

WorkflowNodeLRChart.propTypes = {
  readonly: PropTypes.bool,
  nodes: PropTypes.array,
  addComponent: PropTypes.oneOfType([PropTypes.node, PropTypes.string]),
  selectedNode: PropTypes.object,
  workflowRelatedUsers: PropTypes.array,
  workflowConfig: PropTypes.object,
  setSelectedNode: PropTypes.func,
  onDeleteNode: PropTypes.func,
  onUpdateNode: PropTypes.func,
  onAddNode: PropTypes.func,
  onCopyNode: PropTypes.func,
};

export default WorkflowNodeLRChart;
