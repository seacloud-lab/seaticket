import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { NODE_PARTICIPANTS_TYPE, NODE_TYPE } from '../../constants';
import CommonSettingsComponent from './common-settings-component';
import FormGroupInputSettings from '../common/form-group-input-settings';
import ParticipantSettings from '../common/participant-settings';
import ProcessingTimeLimitSettings from '../common/processing-time-limit-settings';
import NextNodeSettings from '../common/next-node-settings';
import WorkflowFormColumnSettings from '../common/workflow-form-column-settings';
import WorkflowNodeActionSettings from '../common/workflow-node-action-settings';

const gettext = window.gettext;
const { canUseAutomationRules } = window.app.pageOptions;

class NodeSettings extends Component {

  onNodeNameChange = (value) => {
    const { selectedNode } = this.props;
    this.props.changeNode(selectedNode._id, { ...selectedNode, name: value });
  };

  // participants
  onSelectParticipant = (participants) => {
    const { selectedNode } = this.props;
    const newNode = { ...selectedNode, participants };
    this.props.changeNode(selectedNode._id, newNode);
  };

  onChangeNeedAllParticipantsSubmit = (needAllParticipantsSubmit) => {
    const { selectedNode } = this.props;
    const newNode = { ...selectedNode, need_all_participants_submit: needAllParticipantsSubmit };
    this.props.changeNode(selectedNode._id, newNode);
  };

  onParticipantsTypeChange = (participantsType) => {
    const { selectedNode } = this.props;
    const newNode = { ...selectedNode, participants_type: participantsType };
    this.props.changeNode(selectedNode._id, newNode);
  };

  onNodeParticipantsColumnKeyChange = (nodeParticipantsColumnKey) => {
    const { selectedNode } = this.props;
    const newNode = { ...selectedNode, node_participants_column_key: nodeParticipantsColumnKey };
    this.props.changeNode(selectedNode._id, newNode);
  };

  // time limit
  onNodeEnableProcessingTimeLimit = (enableProcessingTimeLimit) => {
    const { selectedNode } = this.props;
    let newNode = { ...selectedNode, enable_processing_time_limit: enableProcessingTimeLimit };
    if (enableProcessingTimeLimit) {
      newNode = { ...newNode, processing_time_limit: '+1d' };
    }
    this.props.changeNode(selectedNode._id, newNode);
  };

  onNodeProcessingTimeLimit = (processingTimeLimit) => {
    const { selectedNode } = this.props;
    const newNode = { ...selectedNode, processing_time_limit: processingTimeLimit };
    this.props.changeNode(selectedNode._id, newNode);
  };

  onNextNodeChange = (value) => {
    const { selectedNode } = this.props;
    this.props.changeNode(selectedNode._id, Object.assign({}, selectedNode, { next_node_id: value }));
  };

  // action
  onAddAction = (newAction) => {
    const { selectedNode } = this.props;
    if (!selectedNode) return;
    const { actions = [] } = selectedNode;
    let newActions = actions.slice(0, );
    newActions.push(newAction);
    this.props.changeNode(selectedNode._id, { ...selectedNode, actions: newActions });
  };

  onDeleteAction = (actionId) => {
    const { selectedNode } = this.props;
    if (!selectedNode) return;
    const { actions = [] } = selectedNode;
    const newActions = actions.filter(action => action._id !== actionId);
    this.props.changeNode(selectedNode._id, { ...selectedNode, actions: newActions });
  };

  onUpdateAction = (newAction) => {
    const { selectedNode } = this.props;
    if (!selectedNode) return;
    const { actions = [] } = selectedNode;
    const newActions = actions.map(action => {
      if (action._id !== newAction._id) return action;
      return newAction;
    });
    this.props.changeNode(selectedNode._id, { ...selectedNode, actions: newActions });
  };

  onUpdateConditionNextNodes = (conditionalNextNodes = []) => {
    const { selectedNode } = this.props;
    if (!selectedNode) return;
    this.props.changeNode(selectedNode._id, { ...selectedNode, conditional_next_nodes: conditionalNextNodes });
  };

  getValidConditionNextNodes = () => {
    const { selectedNode, nodes } = this.props;
    const conditionalNextNodes = selectedNode.conditional_next_nodes;
    if (!Array.isArray(conditionalNextNodes) || conditionalNextNodes.length === 0) return [];
    return conditionalNextNodes.filter(conditionalNextNode => {
      const nextNodeId = conditionalNextNode.next_node_id;
      if (!nextNodeId) return true;
      return nodes.find(node => node._id === nextNodeId);
    });
  };

  render() {
    const { selectedNode, workflowRelatedUsers, workflowConfig, dtableUtils, nodes } = this.props;

    return (
      <CommonSettingsComponent
        header={(
          <>
            <div
              className="workflow-app-settings-header-return mr-1"
              onClick={this.props.showWorkflowSettings}
            >
              <i className="dtable-font dtable-icon-return"></i>
            </div>
            {gettext('Node settings')}
          </>
        )}
      >
        {selectedNode && (
          <>
            <div className='workflow-app-settings-content'>
              <FormGroupInputSettings
                value={selectedNode.name}
                title={gettext('Node name')}
                onValueChange={this.onNodeNameChange}
              />
              {(selectedNode.type !== NODE_TYPE.COMPLETED && selectedNode.type !== NODE_TYPE.CANCELED) && (<div className="workflow-app-setting-divider"></div>)}
              {(selectedNode.type === NODE_TYPE.INIT || selectedNode.type === NODE_TYPE.NORMAL) &&
                <>
                  {selectedNode.type === NODE_TYPE.NORMAL &&
                    <>
                      <ParticipantSettings
                        value={selectedNode.participants}
                        participantsType={selectedNode.participants_type || NODE_PARTICIPANTS_TYPE.STATIC}
                        nodeParticipantsColumnKey={selectedNode.node_participants_column_key}
                        needAllParticipantsSubmit={selectedNode.need_all_participants_submit || false}
                        workflowRelatedUsers={workflowRelatedUsers}
                        participantsColumnKey={workflowConfig.participants_column_key}
                        dtableUtils={dtableUtils}
                        onSelectParticipant={this.onSelectParticipant}
                        onChangeNeedAllParticipantsSubmit={this.onChangeNeedAllParticipantsSubmit}
                        onParticipantsTypeChange={this.onParticipantsTypeChange}
                        onNodeParticipantsColumnKeyChange={this.onNodeParticipantsColumnKeyChange}
                        updateWorkflowRelatedUsers={this.props.updateWorkflowRelatedUsers}
                      />
                      <div className="workflow-app-setting-divider"></div>
                      <ProcessingTimeLimitSettings
                        selectedNode={selectedNode}
                        onNodeEnableProcessingTimeLimit={this.onNodeEnableProcessingTimeLimit}
                        onNodeProcessingTimeLimit={this.onNodeProcessingTimeLimit}
                      />
                      <div className="workflow-app-setting-divider"></div>
                    </>
                  }
                  <NextNodeSettings
                    nodes={nodes}
                    dtableUtils={dtableUtils}
                    workflowRelatedUsers={workflowRelatedUsers}
                    conditionalNextNodes={this.getValidConditionNextNodes()}
                    selectedNode={selectedNode}
                    onNextNodeChange={this.onNextNodeChange}
                    onUpdateConditionNextNodes={this.onUpdateConditionNextNodes}
                  />
                </>
              }
              {selectedNode.type !== NODE_TYPE.CANCELED &&
                <>
                  <div className="workflow-app-setting-divider"></div>
                  <WorkflowFormColumnSettings
                    workflowConfig={workflowConfig}
                    dtableUtils={dtableUtils}
                    updateWorkflowConfig={this.props.updateWorkflowConfig}
                    selectedNode={selectedNode}
                    changeNode={this.props.changeNode}
                  />
                </>
              }
              {canUseAutomationRules && (selectedNode.type === NODE_TYPE.NORMAL || selectedNode.type === NODE_TYPE.COMPLETED) &&
                <>
                  <div className="workflow-app-setting-divider"></div>
                  <WorkflowNodeActionSettings
                    selectedNode={selectedNode}
                    workflowConfig={workflowConfig}
                    workflowRelatedUsers={workflowRelatedUsers}
                    dtableUtils={dtableUtils}
                    onAddAction={this.onAddAction}
                    onDeleteAction={this.onDeleteAction}
                    onUpdateAction={this.onUpdateAction}
                  />
                </>
              }
            </div>
          </>
        )}
      </CommonSettingsComponent>
    );
  }
}

NodeSettings.propTypes = {
  selectedNode: PropTypes.object,
  workflowRelatedUsers: PropTypes.array,
  workflowConfig: PropTypes.object,
  dtableUtils: PropTypes.object,
  nodes: PropTypes.array,
  showWorkflowSettings: PropTypes.func,
  changeNode: PropTypes.func,
  updateWorkflowRelatedUsers: PropTypes.func,
  updateWorkflowConfig: PropTypes.func,
};

export default NodeSettings;
