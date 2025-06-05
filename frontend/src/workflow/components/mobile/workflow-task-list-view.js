import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { toaster, DTableEmptyTip, IconButton } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../../src/api/dtable-web-api';
import { Utils } from '../../../utils/utils';
import { EVENT_OPERATION_TYPE } from '../../../constants/event-operation-type';
import Loading from '../../../components/loading';
import ModalPortal from '../../../components/modal-portal';
import WorkflowTaskDetailView from './workflow-task-detail-view';
import WorkflowTaskItemCard from './workflow-task-item-card';

import '../../css/mobile/dtable-workflow-task-list-view.css';

const { mediaUrl } = window.app.config;
const gettext = window.gettext;

class WorkflowTaskListView extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      taskList: [],
      isTaskDetailShow: false,
    };
    this.page = 0;
    this.hasNewTasks = true;
    this.taskContainer = null;
    this.taskContent = null;
  }

  componentDidMount() {
    this.loadTaskList();
    if (this.props.eventBus) {
      this.unsubscribe = this.props.eventBus.subscribe(EVENT_OPERATION_TYPE.OPEN_WORKFLOW_TASK_DETAIL, this.toggleTaskDetailView);
    }
  }

  componentWillUnmount() {
    if (this.props.eventBus) this.unsubscribe();
    if (this.props.clearWorkflowState) this.props.clearWorkflowState();
  }

  loadTaskList = () => {
    const that = this;
    let apiName = 'listWorkflowOngoingTasks';
    let successCallback = (count) => {
      that.props.updatePendingTasksCount(count);
    };
    const nextPage = this.page + 1;
    const perPage = 500;
    this.setState({ isLoading: true }, () => {
      dtableWebAPI[apiName](nextPage, perPage).then(res => {
        const { task_list = [], count = 0, has_next_page } = res.data;
        const { taskList } = this.state;
        let newTaskList = taskList.slice();
        task_list.forEach(task => {
          const existed = taskList.find(item => item.id === task.id);
          if (existed) return;
          newTaskList.push(task);
        });
        this.setState({ taskList: newTaskList, isLoading: false, init: false });
        this.page = nextPage;
        this.hasNewTasks = has_next_page;
        successCallback && successCallback(count);
      }).catch(error => {
        this.setState({ isLoading: false, init: false });
        const errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
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

  reloadFirstPageWorkflowTasks = () => {
    this.hasNewTasks = true;
    this.page = 0;
    this.setState({ taskList: [] }, () => {
      this.loadTaskList();
    });
  };

  toggleTaskDetailView = () => {
    this.setState({ isTaskDetailShow: !this.state.isTaskDetailShow });
  };

  renderTaskDetail = () => {
    const { workflowTask } = this.props;
    return (
      <ModalPortal>
        <WorkflowTaskDetailView
          isSpecificWorkflow={false}
          toggle={this.toggleTaskDetailView}
          workflowTask={workflowTask}
          reloadFirstPageWorkflowTasks={this.reloadFirstPageWorkflowTasks}
        />
      </ModalPortal>
    );
  };

  renderContainer = () => {
    const { isLoading, taskList } = this.state;
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
            return (
              <WorkflowTaskItemCard
                key={task.id}
                workflowName={workflowName}
                isSpecificWorkflow={false}
                workflowTask={task}
                reloadFirstPageWorkflowTasks={this.reloadFirstPageWorkflowTasks}
              />
            );
          })}
          {isLoading && (<Loading />)}
        </div>
      </div>
    );
  };

  render() {
    return (
      <>
        <div className="workflow-list-view">
          <div className="view-header">
            <div className="view-header-left">
              <span className="dtable-font dtable-icon-workflow"></span>
              <span className="ml-2 text-truncate">{gettext('Workflow')}</span>
            </div>
            <div className="view-header-right">
              <IconButton icon="x" onClick={this.props.toggle} />
            </div>
          </div>
          <div className="list-view-sidebar">
            <ul>
              <li>
                <span>{gettext('Pendings')} {this.props.pendingTasksCount}</span>
              </li>
            </ul>
          </div>
          {this.renderContainer()}
        </div>
        {this.state.isTaskDetailShow && this.renderTaskDetail()}
      </>
    );
  }
}

WorkflowTaskListView.propTypes = {
  pendingTasksCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  workflowTask: PropTypes.object,
  eventBus: PropTypes.object,
  toggle: PropTypes.func,
  updatePendingTasksCount: PropTypes.func,
  clearWorkflowState: PropTypes.func,
};

export default WorkflowTaskListView;
