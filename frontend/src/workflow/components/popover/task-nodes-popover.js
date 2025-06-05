import React from 'react';
import PropTypes from 'prop-types';
import DTablePopover from '../../../components/dtable-popover';

import '../../css/popover/task-nodes-popover.css';

const gettext = window.gettext;

class TaskNodesPopover extends React.Component {

  constructor(props) {
    super(props);
    this.options = Array.isArray(props.nodes) ? props.nodes.map(node => {
      const { _id: id, name } = node;
      return (
        <div
          key={id}
          className="workflow-task-node-item"
          onClick={() => this.onMoveTaskNode(id)}
        >
          {name}
        </div>
      );
    }) : [];
  }

  onToggle = () => {
    this.props.onToggle();
  };

  onMoveTaskNode = (nodeId) => {
    this.props.onMoveTaskNode(nodeId);
    this.onToggle();
  };

  render() {
    const { target } = this.props;
    return (
      <DTablePopover
        target={target}
        popoverClassName="workflow-task-nodes-popover"
        hideDTablePopover={this.onToggle}
        hideDTablePopoverWithEsc={this.onToggle}
      >
        <div className="workflow-task-nodes-container">
          <div className="workflow-task-nodes-tip text-truncate" title={gettext('Move task to a specific node')}>
            {gettext('Move task to a specific node')}
          </div>
          <div className="workflow-task-nodes">
            {this.options}
          </div>
        </div>
      </DTablePopover>
    );
  }
}

TaskNodesPopover.propTypes = {
  target: PropTypes.string.isRequired,
  nodes: PropTypes.array.isRequired,
  onToggle: PropTypes.func.isRequired,
  onMoveTaskNode: PropTypes.func.isRequired
};

export default TaskNodesPopover;
