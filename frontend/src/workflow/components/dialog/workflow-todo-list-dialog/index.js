import React, { Fragment, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { toaster, Loading, DTableEmptyTip, DTableModalHeader } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../../api/dtable-web-api';
import WorkflowTaskListToolbar from './workflow-task-list-toolbar';
import WorkflowTaskItem from '../widgets/workflow-task-item';
import WorkflowTaskPendingDialog from '../workflow-task-pending-dialog';
import { Utils } from '../../../../utils/utils';
import { getShownTaskBySetting } from './utils';
import { gettext, mediaUrl } from '../../../../utils/constants';

import '../../../css/dialog/dtable-workflow-task-list-dialog.css';

const propTypes = {
  toggle: PropTypes.func,
  updatePendingTasksCount: PropTypes.func,
};

const initToolbarSettings = () => {
  const selectedWorkflowOrder = localStorage.getItem('selectedWorkflowOrder');
  return selectedWorkflowOrder ? { selectedWorkflowOrder } : {};
};

const WorkflowTodoListDialog = forwardRef(function WorkflowTodoListDialog({ toggle, updatePendingTasksCount }, ref) {
  const [page, setPage] = useState(0);
  const [hasNewTask, setHasNewTasks] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [taskList, setTaskList] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [countDetails, setCountDetails] = useState([]);
  const [toolbarSettings, setToolbarSettings] = useState(() => initToolbarSettings());
  const [activeWorkflowTask, setActiveWorkflowTask] = useState(null);
  const [isShowWorkflowTaskPendingDialog, setIsShowWorkflowTaskPendingDialog] = useState(false);
  const taskContainer = useRef(null);
  const taskContent = useRef(null);

  const listWorkflowOngoingTasks = async (nextPage, perPage) => {
    try {
      const res = await dtableWebAPI.listWorkflowOngoingTasks(nextPage, perPage);
      return res.data;
    } catch (error) {
      setIsLoading(false);
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    }
  };

  const getWorkflowOngoingTasks = async () => {
    try {
      const res = await dtableWebAPI.getWorkflowOngoingTasksCount();
      return res.data;
    } catch (error) {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    }
  };

  const loadTaskList = async (hasNewTask, page, taskList) => {
    if (!hasNewTask) return;
    const nextPage = page + 1;
    const perPage = 500;
    const data = await listWorkflowOngoingTasks(nextPage, perPage);
    const { task_list = [], count = 0, has_next_page } = data;
    setPage(nextPage);
    setHasNewTasks(has_next_page);
    setIsLoading(false);
    setTotalCount(count);
    setTaskList([...taskList, ...task_list]);
    const countData = await getWorkflowOngoingTasks();
    setCountDetails(countData.details);
    updatePendingTasksCount && updatePendingTasksCount(count);
  };

  useEffect(() => {
    loadTaskList(hasNewTask, page, taskList);
  }, []);

  const loadMore = () => {
    if (isLoading) return;
    const scrollTop = taskContent.current.scrollTop;
    const { height: containerHeight } = taskContainer.current.getBoundingClientRect();
    if (taskContent.current.scrollHeight - scrollTop - containerHeight > 2) return;
    loadTaskList(hasNewTask, page, taskList);
  };

  const reloadFirstPageWorkflowTasks = () => {
    const hasNewTasks = true;
    const pageValue = 0;
    loadTaskList(hasNewTasks, pageValue, []);
  };

  const toggleDialog = (e) => {
    if ((e.keyCode && e.keyCode === Utils.keyCodes.esc) && isShowWorkflowTaskPendingDialog) {
      return;
    }
    toggle();
  };

  const openWorkflowTask = (workflowTask) => {
    setIsShowWorkflowTaskPendingDialog(true);
    setActiveWorkflowTask(workflowTask);
  };

  const closeWorkflowTaskPendingDialog = () => {
    setIsShowWorkflowTaskPendingDialog(false);
    setActiveWorkflowTask(null);
  };

  // the parent component use openWorkflowTaskPendingDialog function
  useImperativeHandle(ref, () => {
    return {
      openWorkflowTaskPendingDialog(activeWorkflowTask) {
        setIsShowWorkflowTaskPendingDialog(true);
        setActiveWorkflowTask(activeWorkflowTask);
      }
    };
  }, []);

  const shownWorkflowTasks = getShownTaskBySetting(taskList, toolbarSettings);

  return (
    <Fragment>
      <Modal
        isOpen={true}
        toggle={toggleDialog}
        className="workflow-task-list-modal"
        size="lg"
        zIndex={100}
      >
        <DTableModalHeader toggle={toggleDialog}>
          <div className="workflow-task-list-modal-header-left d-flex align-items-center">
            <span className="dtable-font dtable-icon-workflow" />
            <span className="ml-2 text-truncate">{gettext('To-do list')}</span>
          </div>
        </DTableModalHeader>
        <ModalBody className="workflow-task-list-modal-body">
          <div className="workflow-task-list-modal-body-container" ref={taskContainer}>
            <WorkflowTaskListToolbar
              taskList={taskList}
              totalCount={totalCount}
              countDetails={countDetails}
              toolbarSettings={toolbarSettings}
              setToolbarSettings={setToolbarSettings}
            />
            <div
              className={`workflow-task-list-modal-body-content todo-list ${isLoading ? 'd-flex align-items-center justify-content-center' : ''}`}
              ref={taskContent}
              onScroll={loadMore}
            >
              {shownWorkflowTasks.length === 0 && !isLoading && (
                <DTableEmptyTip src={`${mediaUrl}img/no-tasks-added.png`} text={gettext('No tasks yet')} />
              )}
              {shownWorkflowTasks.map(task => (
                <WorkflowTaskItem
                  key={task.id}
                  workflowTask={task}
                  openWorkflowTask={openWorkflowTask}
                />
              ))}
              {isLoading && (<Loading />)}
            </div>
          </div>
        </ModalBody>
      </Modal>
      {isShowWorkflowTaskPendingDialog && activeWorkflowTask && (
        <WorkflowTaskPendingDialog
          workflowTask={activeWorkflowTask}
          onReloadWorkflowTasks={reloadFirstPageWorkflowTasks}
          onToggle={closeWorkflowTaskPendingDialog}
        />
      )}
    </Fragment>
  );
});

WorkflowTodoListDialog.propTypes = propTypes;

export default WorkflowTodoListDialog;
