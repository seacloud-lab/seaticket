import React from 'react';
import PaneDivider from './pane-divider';
import eventBus from '../../../utils/event-bus';
import { EVENT_OPERATION_TYPE } from '../../../constants/event-operation-type';

const gettext = window.gettext;

class WorkflowSelectNodeTip extends React.Component {

  componentDidMount() {
    const workflowWdith = localStorage.getItem('workflow_width');
    if (this.workflowNodesRef && workflowWdith) {
      this.workflowNodesRef.style.width = workflowWdith + 'px';
    }
  }

  setWorkflowNodesWidth = (width) => {
    this.workflowNodesRef.style.width = width + 'px';
    localStorage.setItem('workflow_width', width);
    eventBus.dispatch(EVENT_OPERATION_TYPE.UPDATE_WORKFLOW_DESIGN_WIDTH, width);
  };

  render() {
    return (
      <div className='workflow-app-content'>
        <PaneDivider
          setWorkflowNodesWidth={this.setWorkflowNodesWidth}
        />
        <div className="workflow-nodes-container" ref={ref => this.workflowNodesRef = ref}>
          <div className="workflow-nodes-title text-truncate">
            {gettext('Form')}
          </div>
          <span className="select-node-tip">{gettext('Please select a node in workflow to design the form for that node')}</span>
        </div>
      </div>
    );
  }
}

export default WorkflowSelectNodeTip;
