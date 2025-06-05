import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { toaster, DTableEmptyTip, IconButton } from 'dtable-ui-component';
import Loading from '../../../components/loading';
import { gettext } from '../../../utils/constants';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { Utils, PER_PAGE } from '../../../utils/utils';
import { WORKFLOW_ICONS, WORKFLOW_COLORS, TASK_TYPE } from '../../constants';
import WorkflowTaskItemCard from './workflow-task-item-card';
import AddWorkflowTaskView from './add-workflow-task-view';

const { mediaUrl } = window.app.config;

class SpecificWorkflowTaskListView extends Component {

  constructor(props) {
    super(props);
    const { workflow } = props;
    this.state = {
      taskList: [],
      init: true,
      isLoading: true,
      isShowAddWorkflowTaskView: false,
      activeWorkflowTask: null,
      currentTag: workflow.is_admin ? TASK_TYPE.ONGOING : TASK_TYPE.INITIATED,
    };
    this.page = 0;
    this.taskContainer = null;
    this.taskContent = null;
    this.hasNewTasks = true;
    this.forbiddenCancelStates = ['canceled', 'finished'];
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

  loadMore = () => {
    if (this.state.isLoading) return;
    const scrollTop = this.taskContent.scrollTop;
    const scrollHeight = this.taskContent.scrollHeight;
    const { height: containerHeight } = this.taskContainer.getBoundingClientRect();
    const bottomDistance = scrollHeight - scrollTop - containerHeight;
    if (bottomDistance > 20 || bottomDistance <= 0) return;
    this.loadTaskList();
  };

  toggleAddWorkflowTask = (needReloadCurrentTasks = false) => {
    let updateState = { isShowAddWorkflowTaskView: !this.state.isShowAddWorkflowTaskView };
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

  onDeleteWorkflowTask = (workflowTaskId) => {
    const { workflow } = this.props;
    dtableWebAPI.deleteWorkflowTask(workflow.token, workflowTaskId).then(() => {
      const newTaskList = this.state.taskList.slice().filter(task => task.id !== workflowTaskId);
      this.setState({ taskList: newTaskList });
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onCancelWorkflowTask = (workflowTaskId) => {
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

  onResubmitWorkflowTask = (workflowTaskId) => {
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

  renderHeader = () => {
    const { workflow } = this.props;
    const workflowConfig = JSON.parse(workflow.workflow_config);
    const { workflow_name, icon = WORKFLOW_ICONS[0], color = WORKFLOW_COLORS[0] } = workflowConfig;
    return (
      <div className="view-header">
        <div className="specific-view-header-left">
          <div className="specific-icon-content align-items-center justify-content-center" style={{ backgroundColor: color }}>
            <i className={`dtable-icon-color-white workflow-icon-font base-font ${icon}`}></i>
          </div>
          <span className="ml-2 text-truncate">{workflow_name}</span>
        </div>
        <div className="view-header-right">
          <Button
            className="workflow-close-add-btn pt-0 pb-0"
            color="outline-primary"
            onClick={this.toggleAddWorkflowTask}
          >
            <i className="dtable-font dtable-icon-add-table"></i>{' '}
            {gettext('Add task')}
          </Button>
          <IconButton icon="x" onClick={this.props.toggleWorkflowTasksView} className="d-inline-flex ml-2" />
        </div>
      </div>
    );
  };

  renderContainer = () => {
    const { workflow, canCancelTask } = this.props;
    const { isLoading, taskList, currentTag } = this.state;
    const canToggleMore = workflow.is_admin || canCancelTask;
    if (taskList.length === 0 && !isLoading) {
      return (
        <DTableEmptyTip src={`${mediaUrl}img/no-tasks-added.png`} text={gettext('No tasks yet')} />
      );
    }

    return (
      <div className="list-view-container" onScroll={this.loadMore} ref={ref => this.taskContainer = ref}>
        <div className="list-view-content" ref={ref => this.taskContent = ref}>
          {taskList.map(task => {
            const workflowName = JSON.parse(task.dtable_workflow.workflow_config).workflow_name;
            const { node_id, task_state } = task;
            return (
              <WorkflowTaskItemCard
                key={task.id}
                workflowTask={task}
                workflowName={workflowName}
                canCancelTask={canCancelTask && this.forbiddenCancelStates.indexOf(task_state) === -1}
                canToggleMore={canToggleMore}
                canResubmitTask={node_id === 'canceled'}
                isSpecificWorkflow={true}
                isAdmin={workflow.is_admin}
                currentTag={currentTag}
                onDeleteWorkflowTask={this.onDeleteWorkflowTask}
                onCancelWorkflowTask={this.onCancelWorkflowTask}
                onResubmitWorkflowTask={this.onResubmitWorkflowTask}
              />
            );
          })}
          {isLoading && (<Loading />)}
        </div>
      </div>
    );
  };

  render() {
    const { currentTag, isShowAddWorkflowTaskView } = this.state;
    const { workflow } = this.props;

    return (
      <>
        <div className="workflow-list-view">
          {this.renderHeader()}
          <div className="specific-list-view-sidebar">
            <ul>
              <li
                className={`${currentTag === TASK_TYPE.INITIATED ? 'sidebar-item-active' : ''}`}
                onClick={this.switchTag.bind(this, TASK_TYPE.INITIATED)}
              >
                <span>{gettext('Submitted')}</span>
              </li>
              {workflow.is_admin && (
                <>
                  <li
                    className={`${currentTag === TASK_TYPE.ONGOING ? 'sidebar-item-active' : ''}`}
                    onClick={this.switchTag.bind(this, TASK_TYPE.ONGOING)}
                  >
                    <span>{gettext('Ongoing')}</span>
                  </li>
                  <li
                    className={`${currentTag === TASK_TYPE.ALL ? 'sidebar-item-active' : ''}`}
                    onClick={this.switchTag.bind(this, TASK_TYPE.ALL)}
                  >
                    <span>{gettext('All')}</span>
                  </li>
                </>
              )}
            </ul>
          </div>
          {this.renderContainer()}
        </div>
        {isShowAddWorkflowTaskView && (
          <AddWorkflowTaskView
            workflow={workflow}
            toggleAddWorkflowTask={this.toggleAddWorkflowTask}
          />
        )}
      </>
    );
  }
}

SpecificWorkflowTaskListView.propTypes = {
  canCancelTask: PropTypes.bool,
  workflow: PropTypes.object,
  toggleWorkflowTasksView: PropTypes.func,
  refreshPendingtasksCount: PropTypes.func.isRequired,
};

export default SpecificWorkflowTaskListView;
