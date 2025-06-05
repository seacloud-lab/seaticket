import React from 'react';
import PropTypes from 'prop-types';
import deepCopy from 'deep-copy';
import WorkflowHeader from './common/workflow-header';
import WorkflowProcess from './workflow-process';
import WorkflowProcessSettings from './workflow-process-settings';
import WorkflowEditForm from './workflow-edit-form';
import { INIT_NODES } from '../constants';
import eventBus from '../../utils/event-bus';
import { EVENT_OPERATION_TYPE } from '../../constants/event-operation-type';

class WorkflowContent extends React.Component {

  static propTypes = {
    editorConfig: PropTypes.object.isRequired,
    dtableUtils: PropTypes.object,
    workflowConfig: PropTypes.object,
    tables: PropTypes.array,
    columns: PropTypes.array,
    workflowRelatedUsers: PropTypes.array,
    wechatAccounts: PropTypes.array,
    dingtalkAccounts: PropTypes.array,
    isSaving: PropTypes.bool,
    hasUnsavedChanges: PropTypes.bool,
    updateWorkflowConfig: PropTypes.func,
    onSave: PropTypes.func,
    updateWorkflowRelatedUsers: PropTypes.func,
  };

  static defaultProps = {
    workflowRelatedUsers: []
  };

  constructor(props) {
    super(props);
    this.state = {
      selectedNodeId: null,
    };
  }

  setSelectedNode = (selectedNode) => {
    this.setState({
      selectedNodeId: selectedNode ? selectedNode._id : null
    }, () => {
      eventBus.dispatch(EVENT_OPERATION_TYPE.SELECT_WORKFLOW_NODE, selectedNode);
      eventBus.dispatch(EVENT_OPERATION_TYPE.UNSELECT_WORKFLOW_FORM_FIELD);
    });
  };

  changeNode = (nodeId, newNode) => {
    let { workflowConfig } = this.props;
    let newNodes = workflowConfig.nodes.map(node => {
      if (node._id !== nodeId) return node;
      return newNode;
    });
    workflowConfig.nodes = newNodes;
    this.props.updateWorkflowConfig(workflowConfig);
  };

  render() {
    const { workflowConfig, isSaving, tables, dtableUtils, updateWorkflowConfig,
      hasUnsavedChanges, editorConfig, workflowRelatedUsers, wechatAccounts, dingtalkAccounts } = this.props;
    const { selectedNodeId } = this.state;
    let nodes;
    if (workflowConfig.nodes && workflowConfig.nodes.length > 0) {
      nodes = deepCopy(workflowConfig.nodes);
    }
    if (!nodes || nodes.length === 0) {
      nodes = deepCopy(INIT_NODES);
    }
    const selectedNode = nodes.find(node => node._id === selectedNodeId);

    return (
      <div className="workflow-app-container app-main">
        <WorkflowHeader
          isSaving={isSaving}
          workflowConfig={workflowConfig}
          updateWorkflowConfig={updateWorkflowConfig}
          onSave={this.props.onSave}
          hasUnsavedChanges={hasUnsavedChanges}
        />
        <div className="workflow-app-main">
          <WorkflowEditForm
            tables={tables}
            workflowConfig={workflowConfig}
            tableColumns={dtableUtils.columns}
            editorConfig={editorConfig}
            selectedNode={selectedNode}
            changeNode={this.changeNode}
            updateWorkflowConfig={updateWorkflowConfig}
          />
          <div className='app-content workflow-app-nodes-content'>
            <WorkflowProcess
              workflowConfig={workflowConfig}
              nodes={nodes}
              selectedNode={selectedNode}
              dtableUtils={dtableUtils}
              updateWorkflowConfig={updateWorkflowConfig}
              setSelectedNode={this.setSelectedNode}
              workflowRelatedUsers={workflowRelatedUsers}
            />
          </div>
          <div className="workflow-app-settings">
            <WorkflowProcessSettings
              nodes={nodes}
              tables={tables}
              workflowConfig={workflowConfig}
              dtableUtils={dtableUtils}
              updateWorkflowConfig={updateWorkflowConfig}
              setSelectedNode={this.setSelectedNode}
              selectedNode={selectedNode}
              workflowRelatedUsers={workflowRelatedUsers}
              wechatAccounts={wechatAccounts}
              dingtalkAccounts={dingtalkAccounts}
              changeNode={this.changeNode}
              updateWorkflowRelatedUsers={this.props.updateWorkflowRelatedUsers}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default WorkflowContent;
