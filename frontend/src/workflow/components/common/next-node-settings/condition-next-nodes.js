import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { FormGroup } from 'reactstrap';
import { generatorConditionalNextNode } from '../../../utils/workflow-node';
import ConditionNextNode from './condition-next-node';

const gettext = window.gettext;

class ConditionNextNodes extends Component {

  addNewCondition = () => {
    const { conditionalNextNodes } = this.props;
    const conditionalNextNode = generatorConditionalNextNode(conditionalNextNodes);
    let newConditionalNextNodes = conditionalNextNodes.slice(0);
    newConditionalNextNodes.push(conditionalNextNode);
    this.props.onUpdateConditionNextNodes(newConditionalNextNodes);
  };

  onUpdateConditionNextNode = (conditionId, update) => {
    const { conditionalNextNodes } = this.props;
    const updateConditionNextNodeIdx = conditionalNextNodes.findIndex(item => item._id === conditionId);
    let newConditionalNextNodes = conditionalNextNodes.slice(0);
    newConditionalNextNodes[updateConditionNextNodeIdx] = {
      ...conditionalNextNodes[updateConditionNextNodeIdx],
      ...update,
    };
    this.props.onUpdateConditionNextNodes(newConditionalNextNodes);
  };

  deleteConditionNextNode = (conditionId) => {
    const { conditionalNextNodes } = this.props;
    const deleteConditionNextNodeIdx = conditionalNextNodes.findIndex(item => item._id === conditionId);
    let newConditionalNextNodes = conditionalNextNodes.slice(0);
    newConditionalNextNodes.splice(deleteConditionNextNodeIdx, 1);
    this.props.onUpdateConditionNextNodes(newConditionalNextNodes);
  };

  renderConditionalNextNodes = () => {
    const { conditionalNextNodes, nodes, selectedNode, dtableUtils, workflowRelatedUsers } = this.props;
    if (!Array.isArray(conditionalNextNodes) || conditionalNextNodes.length === 0) return null;
    return conditionalNextNodes.map((conditionNextNode, index) => {
      return (
        <ConditionNextNode
          key={(conditionNextNode._id || '') + index}
          selectedNode={selectedNode}
          dtableUtils={dtableUtils}
          conditionNextNode={conditionNextNode}
          workflowRelatedUsers={workflowRelatedUsers}
          nodes={nodes}
          onUpdateConditionNextNode={this.onUpdateConditionNextNode}
          deleteConditionNextNode={this.deleteConditionNextNode}
        />
      );
    });
  };

  render() {
    const { conditionalNextNodes } = this.props;
    const conditionalNextNodesCount = Array.isArray(conditionalNextNodes) ? conditionalNextNodes.length : 0;
    return (
      <FormGroup key="next-node-settings" className="setting-item table-setting next-node-settings">
        {this.renderConditionalNextNodes()}
        <div
          className={`add-item-btn w-100 workflow-node-action-addition-toggle ${conditionalNextNodesCount > 0 ? '' : 'mt-4'}`}
          onClick={this.addNewCondition}
        >
          <i className="dtable-font dtable-icon-add-table mr-2"></i>
          <span className="add-new-option">{gettext('Add conditional next node')}</span>
        </div>
      </FormGroup>
    );
  }
}

ConditionNextNodes.defaultProps = {
  conditionalNextNodes: []
};

ConditionNextNodes.propTypes = {
  nodes: PropTypes.array,
  dtableUtils: PropTypes.object,
  workflowRelatedUsers: PropTypes.array,
  conditionalNextNodes: PropTypes.array,
  selectedNode: PropTypes.object,
  onUpdateConditionNextNodes: PropTypes.func,
};

export default ConditionNextNodes;
