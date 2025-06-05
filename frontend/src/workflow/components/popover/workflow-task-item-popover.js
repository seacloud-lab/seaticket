import React from 'react';
import PropTypes from 'prop-types';
import { PopoverBody } from 'reactstrap';
import DTablePopover from '../../../components/dtable-popover';
import Icon from '../../../components/icon';

import '../../css/popover/workflow-item-popover.css';

const gettext = window.gettext;

class WorkflowTaskItemPopover extends React.Component {

  onEnter = (e) => {
    e.preventDefault();
    this.props.onToggle();
  };

  onDeleteTask = () => {
    this.props.toggleDeleteTask();
    this.props.onToggle();
  };

  onManageParticipants = () => {
    this.props.toggleManageParticipants();
    this.props.onToggle();
  };

  onCancelTask = () => {
    this.props.toggleCancelTask();
    this.props.onToggle();
  };

  onResubmitTask = () => {
    this.props.toggleResubmitTask();
    this.props.onToggle();
  };

  render() {
    const { canManageParticipants, canCancelTask, canResubmitTask, isAdmin } = this.props;
    return (
      <DTablePopover
        target={this.props.target}
        placement="bottom-end"
        popoverClassName="workflow-item-popover"
        hideDTablePopover={this.props.onToggle}
        hideDTablePopoverWithEsc={this.props.onToggle}
        onEnter={this.onEnter}
        hideArrow={true}
      >
        <PopoverBody className="workflow-item-popover-content">
          {isAdmin && (
            <button className="dropdown-item workflow-item-operation" onClick={this.onDeleteTask}>
              <i className="workflow-item-operation-icon dtable-font dtable-icon-delete"></i>
              <span>{gettext('Delete')}</span>
            </button>
          )}
          {canManageParticipants && (
            <button className="dropdown-item workflow-item-operation" onClick={this.onManageParticipants}>
              <i className="workflow-item-operation-icon dtable-font dtable-icon-collaborator"></i>
              <span>{gettext('Change assignee')}</span>
            </button>
          )}
          {canCancelTask && (
            <button className="dropdown-item workflow-item-operation" onClick={this.onCancelTask}>
              <Icon symbol="cancel-task" className="workflow-item-operation-icon" />
              <span>{gettext('Cancel task')}</span>
            </button>
          )}
          {canResubmitTask && (
            <button className="dropdown-item workflow-item-operation" onClick={this.onResubmitTask}>
              <Icon symbol="resubmit-task" className="workflow-item-operation-icon" />
              <span>{gettext('Resubmit task')}</span>
            </button>
          )}
        </PopoverBody>
      </DTablePopover>
    );
  }
}

WorkflowTaskItemPopover.defaultProps = {
  canManageParticipants: false,
  canCancelTask: false,
  canResubmitTask: false,
  isAdmin: false
};

WorkflowTaskItemPopover.propTypes = {
  canManageParticipants: PropTypes.bool,
  canCancelTask: PropTypes.bool,
  canResubmitTask: PropTypes.bool,
  target: PropTypes.string.isRequired,
  onToggle: PropTypes.func.isRequired,
  toggleManageParticipants: PropTypes.func,
  toggleCancelTask: PropTypes.func,
  toggleDeleteTask: PropTypes.func,
  toggleResubmitTask: PropTypes.func,
  isAdmin: PropTypes.bool,
};

export default WorkflowTaskItemPopover;
