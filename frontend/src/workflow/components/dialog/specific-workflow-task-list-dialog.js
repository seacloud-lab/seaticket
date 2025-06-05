import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, NavLink, Nav, NavItem } from 'reactstrap';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import Loading from '../../../components/loading';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { Utils, PER_PAGE } from '../../../utils/utils';
import WorkflowTaskItem from './widgets/workflow-task-item';
import WorkflowTaskAdminDialog from './workflow-task-admin-dialog';
import WorkflowTaskInitiatedDialog from './workflow-task-initiated-dialog';
import { WORKFLOW_ICONS, WORKFLOW_COLORS, TASK_TYPE } from '../../constants';
import AddWorkflowTaskDialog from './add-workflow-task-dialog';

import '../../css/dialog/specific-workflow-task-list-dialog.css';
import '../../css/dtable-workflow-common.css';

const gettext = window.gettext;
const { mediaUrl } = window.app.config;

class SpecificWorkflowTaskListDialog extends React.Component {

  constructor(props) {
    super(props);
    const { workflow } = props;
    this.state = {
      taskList: [],
      init: true,
      isLoading: true,
      isShowWorkflow: false,
      isShowAddWorkflowTaskDialog: false,
      activeWorkflowTask: null,
      currentTag: workflow.is_admin ? TASK_TYPE.ONGOING : TASK_TYPE.INITIATED,
    };
    this.page = 0;
    this.taskContainer = null;
    this.taskContent = null;
    this.hasNewTasks = true;
  }

  componentDidMount() {
    this.loadTaskList();
  }

  loadTaskList = () => {
    if (!this.hasNewTasks) return;
    const nextPage = this.page + 1;
    const { workflow } = this.props;
    const { currentTag } = this.state;
    dtableWebAPI.listWorkflowTasksByType(workflow.token, currentTag, nextPage, PER_PAGE).then(res => {
      const { task_list = [], has_next_page } = res.data;
      const { taskList } = this.state;
      let newTaskList = taskList.slice();
      task_list.forEach(task => {
        const existed = taskList.find(item => item.id === task.id);
        if (existed) return;
        newTaskList.push(task);
      });
      this.setState({
        taskList: newTaskList,
        isLoading: false,
        init: false
      });
      this.page = nextPage;
      this.hasNewTasks = has_next_page;
    }).catch(error => {
      this.setState({
        isLoading: false,
        init: false
      });
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  switchTag = (tag) => {
    if (this.state.currentTag === tag) return;
    this.page = 0;
    this.hasNewTasks = true;
    this.setState({
      currentTag: tag,
      taskList: [],
      isLoading: true,
      init: true,
    }, () => {
      this.loadTaskList();
    });
  };

  onToggle = () => {
    this.props.toggleWorkflowTasksDialog();
  };

  openWorkflowTask = (activeWorkflowTask) => {
    this.setState({ isShowWorkflow: true, activeWorkflowTask });
  };

  loadMore = () => {
    if (this.state.isLoading) return;
    const scrollTop = this.taskContent.scrollTop;
    const { height: containerHeight } = this.taskContainer.getBoundingClientRect();
    if (this.taskContent.scrollHeight - scrollTop - containerHeight > 2) return;
    this.loadTaskList();
  };

  toggleAddWorkflowTaskDialog = (needReloadCurrentTasks = false) => {
    let updateState = { isShowAddWorkflowTaskDialog: !this.state.isShowAddWorkflowTaskDialog };
    if (needReloadCurrentTasks) {
      this.page = 0;
      this.hasNewTasks = true;
      updateState['taskList'] = [];
      updateState['isLoading'] = true;
      updateState['init'] = true;
    }
    this.setState(updateState, () => {
      if (!needReloadCurrentTasks) return;
      this.loadTaskList();
    });
  };

  closeWorkflowTaskAdminDialog = () => {
    this.setState({ isShowWorkflow: false, activeWorkflowTask: null });
  };

  onDeleteWorkflowTask = (workflowTaskId) => {
    const { workflow } = this.props;
    dtableWebAPI.deleteWorkflowTask(workflow.token, workflowTaskId).then(() => {
      const newTaskList = this.state.taskList.slice().filter(task => task.id !== workflowTaskId);
      this.setState({ taskList: newTaskList });
      this.props.refreshPendingtasksCount();
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onUpdateParticipants = (workflowTaskId, participants) => {
    let newTaskList = this.state.taskList.slice();
    newTaskList.forEach(item => {
      if (item.id !== workflowTaskId) return;
      item.participants = participants;
    });
    this.setState({ taskList: newTaskList });
  };

  onCancelTask = (workflowTaskId) => {
    const { workflow } = this.props;
    const { taskList, currentTag } = this.state;
    dtableWebAPI.cancelWorkflowTask(workflow.token, workflowTaskId).then(res => {
      const { task: canceledTask } = res.data;
      let newTaskList;
      if (currentTag === TASK_TYPE.ONGOING) {
        newTaskList = taskList.slice().filter(task => task.id !== workflowTaskId);
      } else {
        newTaskList = taskList.slice().map(task => {
          if (task.id === canceledTask.id) return canceledTask;
          return task;
        });
      }
      this.setState({ taskList: newTaskList });
      this.props.refreshPendingtasksCount();
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onResubmitTask = (workflowTaskId) => {
    const { workflow } = this.props;
    dtableWebAPI.resubmitWorkflowTask(workflow.token, workflowTaskId).then(res => {
      const newTaskList = this.state.taskList.map(task => {
        if (task.id !== workflowTaskId) {
          return task;
        }
        return res.data.task;
      });
      this.setState({ taskList: newTaskList });
      this.props.refreshPendingtasksCount();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  };

  renderContent = () => {
    const { workflow, canCancelTask } = this.props;
    const { isLoading, taskList, currentTag } = this.state;
    if (taskList.length === 0 && !isLoading) {
      return (
        <DTableEmptyTip src={`${mediaUrl}img/no-tasks-added.png`} text={gettext('No tasks yet')} />
      );
    }

    const canToggleMore = workflow.is_admin || canCancelTask;

    return (
      <>
        {taskList.map(task => {
          return (
            <WorkflowTaskItem
              key={task.id}
              workflowTask={task}
              openWorkflowTask={this.openWorkflowTask}
              onDeleteWorkflowTask={this.onDeleteWorkflowTask}
              canToggleMore={canToggleMore}
              isAdmin={workflow.is_admin}
              canManageParticipants={currentTag === TASK_TYPE.ONGOING}
              onUpdateParticipants={this.onUpdateParticipants}
              canCancelTask={canCancelTask}
              onCancelTask={this.onCancelTask}
              onResubmitTask={this.onResubmitTask}
            />
          );
        })}
        {isLoading && (<Loading />)}
      </>
    );
  };

  render() {
    const { workflow } = this.props;
    const { init, isShowWorkflow, activeWorkflowTask, currentTag, isShowAddWorkflowTaskDialog } = this.state;
    const workflowConfig = JSON.parse(workflow.workflow_config);
    const { workflow_name, icon = WORKFLOW_ICONS[0], color = WORKFLOW_COLORS[0] } = workflowConfig;
    let WorkflowTaskDialog;
    if (currentTag === TASK_TYPE.ALL || currentTag === TASK_TYPE.ONGOING) {
      WorkflowTaskDialog = WorkflowTaskAdminDialog;
    } else {
      WorkflowTaskDialog = WorkflowTaskInitiatedDialog;
    }
    return (
      <>
        <Modal
          isOpen={true}
          toggle={this.onToggle}
          className="workflow-task-list-modal specific-workflow-task-list-modal"
          size="lg"
          zIndex={100}
        >
          <div className="modal-header align-items-center">
            <div className="specific-workflow-task-title-container d-flex align-items-center">
              <div
                className="workflow-icon-content mr-2 d-flex align-items-center justify-content-center"
                style={{ backgroundColor: color }}
              >
                <i className={`dtable-icon-color-white workflow-icon-font base-font ${icon}`}></i>
              </div>
              <span className="flex-1 text-truncate" title={workflow_name}>{workflow_name}</span>
            </div>
            <Nav className="workflow-task-list-modal-nav">
              <NavItem onClick={this.switchTag.bind(this, TASK_TYPE.INITIATED)}>
                <NavLink active={currentTag === TASK_TYPE.INITIATED} href="#">{gettext('Submitted')}</NavLink>
              </NavItem>
              {workflow.is_admin &&
                <Fragment>
                  <NavItem onClick={this.switchTag.bind(this, TASK_TYPE.ONGOING)}>
                    <NavLink active={currentTag === TASK_TYPE.ONGOING} href="#">{gettext('Ongoing')}</NavLink>
                  </NavItem>
                  <NavItem onClick={this.switchTag.bind(this, TASK_TYPE.ALL)}>
                    <NavLink active={currentTag === TASK_TYPE.ALL} href="#">{gettext('All')}</NavLink>
                  </NavItem>
                </Fragment>
              }
            </Nav>
            <div className="workflow-close-btn-container d-flex align-items-center">
              <Button
                className="workflow-close-add-btn pt-0 pb-0 mr-4"
                color="outline-primary"
                onClick={() => this.toggleAddWorkflowTaskDialog(false)}
              >
                <i className="dtable-font dtable-icon-add-table"></i>{' '}
                {gettext('Add task')}
              </Button>
              <div className="seatable-icon-btn dtable-modal-close-inner" onClick={this.onToggle} role="button" aria-label={gettext('Close')}>
                <i className="seatable-icon dtable-font dtable-icon-x" aria-hidden="true"></i>
              </div>
            </div>
          </div>
          <ModalBody className='workflow-task-list-modal-body'>
            <div className="workflow-task-list-modal-body-container" ref={ref => this.taskContainer = ref}>
              <div
                className={`workflow-task-list-modal-body-content ${init ? 'd-flex align-items-center justify-content-center' : ''}`}
                ref={ref => this.taskContent = ref}
                onScroll={this.loadMore}
              >
                {this.renderContent()}
              </div>
            </div>
          </ModalBody>
        </Modal>
        {isShowWorkflow && activeWorkflowTask &&
          <WorkflowTaskDialog
            workflowTask={activeWorkflowTask}
            onToggle={this.closeWorkflowTaskAdminDialog}
          />
        }
        {isShowAddWorkflowTaskDialog && (
          <AddWorkflowTaskDialog
            workflow={workflow}
            toggleAddWorkflowTaskDialog={this.toggleAddWorkflowTaskDialog}
            refreshPendingtasksCount={this.props.refreshPendingtasksCount}
          />
        )}
      </>
    );
  }
}

SpecificWorkflowTaskListDialog.propTypes = {
  workflow: PropTypes.object,
  canCancelTask: PropTypes.bool,
  toggleWorkflowTasksDialog: PropTypes.func,
  refreshPendingtasksCount: PropTypes.func
};

export default SpecificWorkflowTaskListDialog;
