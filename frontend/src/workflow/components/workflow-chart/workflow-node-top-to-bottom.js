import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { NODE_TYPE, NODE_HEIGHT_GAP, NODE_WIDTH, NODE_WIDTH_GAP, HALF_NODE_HEIGHT_GAP } from '../../constants';
import { getWorkflowPathsAndLines } from '../../utils/workflow-node';
import WorkflowNode from './workflow-node';
import WorkflowEmptyNode from './workflow-empty-node';
import Line from './line';
import eventBus from '../../../utils/event-bus';
import { EVENT_OPERATION_TYPE } from '../../../constants/event-operation-type';

class WorkflowNodeTBChart extends Component {

  constructor(props) {
    super(props);
    this.state = {
      width: this.getWidth()
    };
  }

  componentDidMount() {
    this.updateWorkflowDesignWidth = eventBus.subscribe(EVENT_OPERATION_TYPE.UPDATE_WORKFLOW_DESIGN_WIDTH, this.setWidth);
  }

  componentWillUnmount() {
    this.updateWorkflowDesignWidth();
  }

  onAddNode = (line) => {
    this.props.onAddNode(line);
  };

  getWidth = (workflowWidth) => {
    const { readonly } = this.props;
    if (readonly) return 300;
    const windowWidth = window.innerWidth;
    const formSettingsWidth = workflowWidth || localStorage.getItem('workflow_width', 300) || 300; // 300: form settings default width
    return windowWidth - formSettingsWidth - 300; // 300: node or workflow settings width
  };

  setWidth = (workflowWidth) => {
    const width = this.getWidth(workflowWidth);
    this.setState({ width });
  };

  renderPaths = (paths, lines) => {
    const { readonly, selectedNode, workflowRelatedUsers } = this.props;
    if (!Array.isArray(paths) || paths.length === 0) return null;
    return (
      <>
        {paths.map((path, pathIdx) => {
          const lastPathNodeIdx = path.length - 1;
          return (
            <div
              key={`path_item_${pathIdx}`}
              className="path-item d-flex"
              style={{ width: NODE_WIDTH, marginRight: NODE_WIDTH_GAP }}
            >
              {path.map((node, nodeIdx) => {
                const isLastNode = lastPathNodeIdx === nodeIdx;
                const style = { marginBottom: isLastNode ? HALF_NODE_HEIGHT_GAP : NODE_HEIGHT_GAP, marginRight: NODE_WIDTH_GAP };
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
                    style={style}
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
        <Line key={line.id} selectedNode={selectedNode} readonly={readonly} line={line} onAddNode={this.onAddNode} />
      );
    });
  };

  renderAddComponent = (maxWidth) => {
    const { addComponent } = this.props;
    if (!addComponent) return null;
    return (
      <div className="d-flex align-items-center" style={{ width: maxWidth, flexDirection: 'column', minWidth: '100%' }}>
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
    const { width } = this.state;
    const { paths, lines, otherNodes } = getWorkflowPathsAndLines(nodes);
    const pathsCount = paths.length;
    const maxWidth = (pathsCount - 1) * (NODE_WIDTH + NODE_WIDTH_GAP) + NODE_WIDTH;

    return (
      <div className="workflow-paths-container workflow-paths-TB-container w-100" style={{ padding: maxWidth < width ? `16px ${(width - NODE_WIDTH) / 2}px` : '16px 20px' }}>
        <div className="workflow-paths-content position-relative" style={{ width: maxWidth }}>
          {this.renderPaths(paths, lines)}
        </div>
        {this.renderOtherNodes(maxWidth, otherNodes)}
        {this.renderAddComponent(maxWidth)}
      </div>
    );
  }
}

WorkflowNodeTBChart.defaultProps = {
  readonly: false,
  workflowConfig: {
    can_cancel_task: false,
  },
};

WorkflowNodeTBChart.propTypes = {
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

export default WorkflowNodeTBChart;
