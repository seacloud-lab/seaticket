import React from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import { I18nextProvider } from 'react-i18next';
import { toaster } from 'dtable-ui-component';
import i18n from '../../i18n-seafile-editor';
import { gettext, mediaUrl, workflowHelpLink, cloudMode, isOrgContext } from '../../utils/constants';
import { dtableWebAPI } from '../../api/dtable-web-api';
import { Utils } from '../../utils/utils';
import ModalPortal from '../../components/modal-portal';
import MyManagedWorkflows from './workflow/workflow-group/my-managed-workflows';
import CanUseWorkflows from './workflow/workflow-group/can-use-workflows';
import SharedForms from './workflow/workflow-group/shared-forms';
import AddFolderDialog from './workflow/workflow-group/add-folder-dialog';
import WorkflowTodoListDialog from '../../workflow/components/dialog/workflow-todo-list-dialog/index';
import WorkflowFolderDialog from './workflow/workflow-group/workflow-folder-dialog/';
import WorkflowFolderView from './workflow/workflow-group/workflow-folder-view';
import WorkflowTaskListView from '../../workflow/components/mobile/workflow-task-list-view';
import { TASK_TYPE } from '../../workflow/constants';
import { EVENT_OPERATION_TYPE } from '../../constants/event-operation-type';
import { MANAGED_WORKFLOW_FOLDER, CAN_USED_WORKFLOW_FOLDER, MY_MANAGED_WORKFLOWS, CAN_USE_WORKFLOWS } from '../../workflow/constants/workflow-folder';
import eventBus from '../../utils/event-bus';
import Loading from '../../components/loading';
import WorkflowGroupModel from '../../workflow/model/workflow-group';
import WorkflowNotification from './workflow/workflow-notification/';

import '../../css/dtable-workflows-panel.css';

const isDesktop = Utils.isDesktop();

class MainPanelWorkflowsPanel extends React.Component {
  constructor(props) {
    super(props);
    const { workflowTag = '' } = props;
    this.state = {
      pendingTasksCount: '',
      operateType: '',
      myManagedWorkflows: [],
      canUseWorkflows: [],
      sharedForms: [],
      managedWorkflowFolders: [],
      canUsedWorkflowFolders: [],
      currentFolder: null,
      folderType: '',
      errorMsg: '',
      isListDialogShow: false,
      isListViewShow: false,
      listDialogTag: workflowTag,
      workflowItemWidth: 168,
      numberOfWorkflowsPerRow: 1,
      isLoading: true,
      isShowAddFolderDialog: false,
      isShowWorkflowFolderDialog: false,
      isShowWorkflowFolderView: false,
    };
    this.eventBus = eventBus;
    this.workflowTaskListDialogRef = React.createRef();
  }

  componentDidMount() {
    window.addEventListener('resize', this.onResize);
    this.unsubscribeUpdateTaskCount = this.eventBus.subscribe(EVENT_OPERATION_TYPE.UPDATE_WORKFLOW_TASK_COUNT, this.updatePendingTasksCount);
    const { workflowTag = '', workflowTask } = this.props;
    dtableWebAPI.listSharedWorkflows().then(res => {
      const { my_managed_workflows, can_use_workflows, workflow_folders } = res.data;
      const myManagedWorkflows = Array.isArray(my_managed_workflows) ? my_managed_workflows.map(workflow =>
        new WorkflowGroupModel(workflow)) : [];
      const canUseWorkflows = Array.isArray(can_use_workflows) ? can_use_workflows.map(workflow =>
        new WorkflowGroupModel(workflow)) : [];
      const managedWorkflowFolders = Array.isArray(workflow_folders) ? workflow_folders.filter(folder => folder.folder_type === MANAGED_WORKFLOW_FOLDER) : [];
      const canUsedWorkflowFolders = Array.isArray(workflow_folders) ? workflow_folders.filter(folder => folder.folder_type === CAN_USED_WORKFLOW_FOLDER) : [];
      this.setState({
        myManagedWorkflows,
        canUseWorkflows,
        managedWorkflowFolders,
        canUsedWorkflowFolders,
        isLoading: false
      });
      this.onResize();
      return dtableWebAPI.getWorkflowOngoingTasksCount();
    }).then(res => {
      this.setState({ pendingTasksCount: res.data.count }, () => {
        if (workflowTag) {
          this.openList(workflowTask);
        }
      });
    }).catch(error => {
      this.setState({ errorMsg: Utils.getErrorMsg(error) });
    });
    if (!cloudMode || isOrgContext) {
      dtableWebAPI.listSharedForms().then(res => {
        this.setState({
          sharedForms: res.data.shared_list,
        });
      }).catch((error) => {
        this.setState({
          errorMsg: Utils.getErrorMsg(error),
        });
      });
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { workflowTag = '', workflowTask } = nextProps;
    if (this.state.listDialogTag !== workflowTag) {
      this.setState({ listDialogTag: workflowTag });
    }
    if (workflowTag) {
      this.openList(workflowTask);
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
    this.unsubscribeUpdateTaskCount();
  }

  onResize = () => {
    // 16: workflow item margin with or view content padding width
    // 184: workflowItem min-width[168] and margin right[16]
    // 352: two workflowItem min-width sum[336] + padding[32] + margin right[16]
    // 536: three workflowItem min-width sum[504] + padding[32] + two margin right[32]
    if (!this.curViewContent) return;
    const { clientWidth, offsetWidth } = this.curViewContent;
    if (!isDesktop) {
      const contentWidth = clientWidth - 16 * 2;
      let numberOfWorkflowsPerRow = 1;
      let workflowItemWidth = contentWidth;
      if (contentWidth >= 536) {
        numberOfWorkflowsPerRow = 3;
        // The first and second workflow items margin-right sum is 32
        workflowItemWidth = (contentWidth - 32) / 3;
      } else if (contentWidth >= 352) {
        numberOfWorkflowsPerRow = 2;
        // The first workflow item margin-right is 16
        workflowItemWidth = (contentWidth - 16) / 2;
      }
      this.setState({ workflowItemWidth, numberOfWorkflowsPerRow });
      return;
    }
    const scrollBarWidth = offsetWidth - clientWidth;
    const workflowListWidth = parseInt(window.innerWidth * (1 - 0.22) - 16 * 2 + 16 - scrollBarWidth);

    const numberOfWorkflowsPerRow = Math.floor(workflowListWidth / 184);
    const remainingWidth = workflowListWidth % 184;
    let workflowItemWidth;
    if (remainingWidth > 0) {
      workflowItemWidth = 168 + remainingWidth / numberOfWorkflowsPerRow;
    } else {
      workflowItemWidth = 168;
    }
    this.setState({
      workflowItemWidth: workflowItemWidth,
      numberOfWorkflowsPerRow: numberOfWorkflowsPerRow
    });
  };

  getWorkflowItemClassAndStyle = (index, workflowsCount) => {
    const { workflowItemWidth, numberOfWorkflowsPerRow } = this.state;

    // 0.22: percentage of side panel; 16: cur-view-content's padding left/right;
    // 168: workflow item width; 20: workflow item margin right/bottom
    let allLineWorkflowCount = parseInt(workflowsCount / numberOfWorkflowsPerRow) * numberOfWorkflowsPerRow;
    if (allLineWorkflowCount === workflowsCount) {
      allLineWorkflowCount = allLineWorkflowCount - numberOfWorkflowsPerRow;
    }
    let className = '';
    let style = { width: workflowItemWidth };

    if (isDesktop) {
      const validIndex = index + 1;
      if (validIndex % numberOfWorkflowsPerRow === 0) {
        className += 'mr-0 ';
      }
      if (validIndex > allLineWorkflowCount) {
        className += 'mb-0 ';
      }
      return { className, style };
    }
    if (index > numberOfWorkflowsPerRow - 1) {
      style.marginLeft = index % numberOfWorkflowsPerRow === 0 ? - ((workflowItemWidth + 16) * numberOfWorkflowsPerRow) : 0;
      style.marginTop = parseInt(index / numberOfWorkflowsPerRow) * 192;
      return { className, style };
    }
    return { className, style };
  };

  getLoadMoreStyle = () => {
    const workspaceClientWidth = this.workflowContainer.clientWidth;
    const marginLeft = - (workspaceClientWidth + 8);
    const marginTop = 390;
    const style = { marginLeft, marginTop };
    if (isDesktop) {
      return {};
    }
    return style;
  };

  toggleTodoList = (listDialogTag) => {
    if (isDesktop) {
      this.setState({
        isListDialogShow: !this.state.isListDialogShow,
        listDialogTag: listDialogTag
      });
    } else {
      this.setState({
        isListViewShow: !this.state.isListViewShow,
        listDialogTag: listDialogTag
      });
    }
  };

  onToggleAddFolderDialog = (folderType) => {
    this.setState({
      folderType,
      isShowAddFolderDialog: !this.state.isShowAddFolderDialog,
    });
  };

  onToggleCurrentFolderDialog = (folderType, folderItem) => {
    this.setState({
      folderType,
      currentFolder: folderItem,
      isShowWorkflowFolderDialog: !this.state.isShowWorkflowFolderDialog,
    });
  };

  onToggleCurrentFolderView = (folderItem) => {
    this.setState({
      currentFolder: folderItem,
      isShowWorkflowFolderView: !this.state.isShowWorkflowFolderView
    });
  };

  onChangeCurrentFolder = (workflowFolder) => {
    this.setState({ currentFolder: workflowFolder });
  };

  openList = (workflowTask) => {
    if (isDesktop) {
      this.setState({ isListDialogShow: true }, () => {
        if (!workflowTask) return;
        setTimeout(() => {
          this.workflowTaskListDialogRef.current.openWorkflowTaskPendingDialog(workflowTask);
        }, 600);
      });
      return;
    }
    this.setState({ isListViewShow: true }, () => {
      if (!workflowTask) return;
      this.eventBus.dispatch(EVENT_OPERATION_TYPE.OPEN_WORKFLOW_TASK_DETAIL);
    });
  };

  updatePendingTasksCount = (newCount) => {
    this.setState({ pendingTasksCount: newCount });
  };

  refreshPendingtasksCount = () => {
    dtableWebAPI.getWorkflowOngoingTasksCount().then(res => {
      this.updatePendingTasksCount(res.data.count);
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      this.setState({ errorMsg: errMessage });
    });
  };

  onUpdateWorkflowProperties = (workflowItem, updates, callBack) => {
    const { token } = workflowItem;
    const { myManagedWorkflows } = this.state;
    dtableWebAPI.updateWorkflowProperties(token, updates).then(res => {
      const newWorkflow = res.data.workflow;
      let newMyManagedWorkflows = myManagedWorkflows.slice(0, );
      const workflowItemIndex = newMyManagedWorkflows.findIndex(workflow => workflow.token === workflowItem.token);
      if (workflowItemIndex !== -1) {
        newMyManagedWorkflows[workflowItemIndex] = {
          ...workflowItem,
          ...newWorkflow
        };
      }
      this.setState({ myManagedWorkflows: newMyManagedWorkflows });
      callBack && callBack();
    }).catch(error => {
      callBack && callBack(error);
    });
  };

  onDeleteWorkflow = (workflowItem, callBack) => {
    const { token } = workflowItem;
    const { myManagedWorkflows } = this.state;
    dtableWebAPI.deleteWorkflow(token).then(res => {
      let newMyManagedWorkflows = myManagedWorkflows.slice(0, );
      const workflowItemIndex = newMyManagedWorkflows.findIndex(workflow => workflow.token === workflowItem.token);
      if (workflowItemIndex !== -1) {
        newMyManagedWorkflows.splice(workflowItemIndex, 1);
      }
      this.setState({ myManagedWorkflows: newMyManagedWorkflows });
      callBack && callBack();
    }).catch(error => {
      callBack && callBack(error);
    });
  };

  onAddFolder = async (folderName) => {
    const { folderType } = this.state;
    try {
      const res = await dtableWebAPI.createWorkflowFolder(folderName, folderType);
      const { folder } = res.data;
      if (folderType === MANAGED_WORKFLOW_FOLDER) {
        const { managedWorkflowFolders } = this.state;
        const updatedFolders = [...managedWorkflowFolders, folder];
        this.setState({ managedWorkflowFolders: updatedFolders });
      } else {
        const { canUsedWorkflowFolders } = this.state;
        const updatedFolders = [...canUsedWorkflowFolders, folder];
        this.setState({ canUsedWorkflowFolders: updatedFolders });
      }
    } catch (err) {
      this.handlerError(err);
    }
  };

  onDeleteFolder = async (folderItem) => {
    const { id: folderId, folder_type: folderType } = folderItem;
    try {
      const res = await dtableWebAPI.deleteWorkflowFolder(folderId);
      const { success } = res.data;
      if (success) {
        if (folderType === MANAGED_WORKFLOW_FOLDER) {
          const { managedWorkflowFolders } = this.state;
          const updatedFolders = managedWorkflowFolders.filter(folder => folder.id !== folderId);
          this.setState({ managedWorkflowFolders: updatedFolders });
        } else {
          const { canUsedWorkflowFolders } = this.state;
          const updatedFolders = canUsedWorkflowFolders.filter(folder => folder.id !== folderId);
          this.setState({ canUsedWorkflowFolders: updatedFolders });
        }
      }
    } catch (err) {
      this.handlerError(err);
    }
  };

  onRenameFolder = async (folderItem, newName) => {
    const { id: folderId, folder_type: folderType } = folderItem;
    try {
      const res = await dtableWebAPI.renameWorkflowFolder(newName, folderId);
      const { folder: updatedFolder } = res.data;
      if (folderType === MANAGED_WORKFLOW_FOLDER) {
        const { managedWorkflowFolders } = this.state;
        const updatedFolders = managedWorkflowFolders.map(folder => {
          return folder.id === updatedFolder.id ? { ...folder, name: updatedFolder.name } : folder;
        });
        this.setState({ managedWorkflowFolders: updatedFolders });
      } else {
        const { canUsedWorkflowFolders } = this.state;
        const updatedFolders = canUsedWorkflowFolders.map(folder => {
          return folder.id === updatedFolder.id ? { ...folder, name: updatedFolder.name } : folder;
        });
        this.setState({ canUsedWorkflowFolders: updatedFolders });
      }
    } catch (err) {
      this.handlerError(err);
    }
  };

  onMoveWorkflowToFolder = async (type, workflow, folderId) => {
    const { token, folder_id = '/' } = workflow;
    const sourceFolderId = folder_id;
    const targetFolderId = folderId;
    try {
      const res = await dtableWebAPI.moveWorkflowToFolder(token, sourceFolderId, targetFolderId);
      const { success } = res.data;
      if (success) {
        if (type === MY_MANAGED_WORKFLOWS) {
          this.updateManagedWorkflow(workflow, targetFolderId);
        } else {
          this.updateCanUseWorkflow(workflow, targetFolderId);
        }
      }
    } catch (err) {
      this.handlerError(err);
    }
  };

  updateManagedWorkflow = (workflow, targetFolderId) => {
    const { myManagedWorkflows } = this.state;
    const { id: workflowId } = workflow;
    let updatedWorkflows;
    if (targetFolderId === '/') {
      workflow.folder_id = '/';
      const newWorkflow = new WorkflowGroupModel(workflow);
      updatedWorkflows = [...myManagedWorkflows, newWorkflow];
    } else {
      updatedWorkflows = myManagedWorkflows.filter(workflow => workflow.id !== workflowId);
    }
    this.setState({ myManagedWorkflows: updatedWorkflows });
  };

  updateCanUseWorkflow = (workflow, targetFolderId) => {
    const { canUseWorkflows } = this.state;
    const { id: workflowId } = workflow;
    let updatedWorkflows;
    if (targetFolderId === '/') {
      workflow.folder_id = '/';
      const newWorkflow = new WorkflowGroupModel(workflow);
      updatedWorkflows = [...canUseWorkflows, newWorkflow];
    } else {
      updatedWorkflows = canUseWorkflows.filter(workflow => workflow.id !== workflowId);
    }
    this.setState({ canUseWorkflows: updatedWorkflows });
  };

  onMoveCanUsedWorkflowToFolder = async (workflow, folderId) => {
    this.onMoveWorkflowToFolder(CAN_USE_WORKFLOWS, workflow, folderId);
  };

  handlerError = (err) => {
    const errMessage = Utils.getErrorMsg(err);
    toaster.danger(errMessage);
  };

  openWorkflowUsingHelp = () => {
    window.open(workflowHelpLink);
  };

  renderHeader = () => {
    const { isShowHeader } = this.props;
    if (!isShowHeader) return null;
    return (
      <div className="main-panel-workflow-header d-flex align-items-center">
        <div className="main-panel-workflow-title">{gettext('Workflow')}</div>
        {workflowHelpLink &&
          <div className="main-panel-workflow-help d-flex align-items-center" onClick={this.openWorkflowUsingHelp}>
            <i className="dtable-font dtable-icon-use-help"></i>
            {isDesktop && (<span className="ml-2 main-panel-workflow-help-tip">{gettext('Help')}</span>)}
          </div>
        }
      </div>
    );
  };

  renderContent = () => {
    const { myManagedWorkflows, managedWorkflowFolders, canUseWorkflows, canUsedWorkflowFolders, isLoading, numberOfWorkflowsPerRow } = this.state;
    if (isLoading) {
      return (<Loading />);
    }
    return (
      <>
        <MyManagedWorkflows
          workflows={myManagedWorkflows}
          managedWorkflowFolders={managedWorkflowFolders}
          numberOfWorkflowsShown={isDesktop ? numberOfWorkflowsPerRow : 2 * numberOfWorkflowsPerRow}
          getWorkflowItemClassAndStyle={this.getWorkflowItemClassAndStyle}
          onUpdateWorkflowProperties={this.onUpdateWorkflowProperties}
          onDeleteWorkflow={this.onDeleteWorkflow}
          refreshPendingtasksCount={this.refreshPendingtasksCount}
          getLoadMoreStyle={this.getLoadMoreStyle}
          onDeleteFolder={this.onDeleteFolder}
          onRenameFolder={this.onRenameFolder}
          onToggleAddFolderDialog={this.onToggleAddFolderDialog}
          onToggleCurrentFolderDialog={this.onToggleCurrentFolderDialog}
          onToggleCurrentFolderView={this.onToggleCurrentFolderView}
          onMoveWorkflowToFolder={this.onMoveWorkflowToFolder.bind(this, MY_MANAGED_WORKFLOWS)}
        />
        <CanUseWorkflows
          workflows={canUseWorkflows}
          canUsedWorkflowFolders={canUsedWorkflowFolders}
          getWorkflowItemClassAndStyle={this.getWorkflowItemClassAndStyle}
          refreshPendingtasksCount={this.refreshPendingtasksCount}
          onDeleteFolder={this.onDeleteFolder}
          onRenameFolder={this.onRenameFolder}
          onToggleAddFolderDialog={this.onToggleAddFolderDialog}
          onToggleCurrentFolderDialog={this.onToggleCurrentFolderDialog}
          onToggleCurrentFolderView={this.onToggleCurrentFolderView}
          onMoveWorkflowToFolder={this.onMoveCanUsedWorkflowToFolder}
        />
        {(!cloudMode || isOrgContext) &&
          <SharedForms
            sharedForms={this.state.sharedForms}
            getWorkflowItemClassAndStyle={this.getWorkflowItemClassAndStyle}
          />
        }
      </>
    );
  };

  renderWorkflowDialog = () => {
    const { folderType, currentFolder, myManagedWorkflows, canUseWorkflows, managedWorkflowFolders, canUsedWorkflowFolders, workflowItemWidth } = this.state;
    let workflows;
    let folders;
    let isManaged;
    let onMoveWorkflowToFolder;
    if (folderType === MANAGED_WORKFLOW_FOLDER) {
      workflows = myManagedWorkflows;
      folders = managedWorkflowFolders;
      onMoveWorkflowToFolder = this.onMoveWorkflowToFolder.bind(this, MY_MANAGED_WORKFLOWS);
      isManaged = true;
    } else {
      workflows = canUseWorkflows;
      folders = canUsedWorkflowFolders;
      onMoveWorkflowToFolder = this.onMoveCanUsedWorkflowToFolder;
      isManaged = false;
    }
    return (
      <WorkflowFolderDialog
        currentFolder={currentFolder}
        workflows={workflows}
        folders={folders}
        folderType={folderType}
        isManaged={isManaged}
        workflowItemWidth={workflowItemWidth}
        getWorkflowItemClassAndStyle={this.getWorkflowItemClassAndStyle}
        refreshPendingtasksCount={this.refreshPendingtasksCount}
        onAddFolder={this.onAddFolder}
        onRenameFolder={this.onRenameFolder}
        onDeleteFolder={this.onDeleteFolder}
        onMoveWorkflowToFolder={onMoveWorkflowToFolder}
        onChangeCurrentFolder={this.onChangeCurrentFolder}
        onDeleteWorkflow={this.onDeleteWorkflow}
        onUpdateWorkflowProperties={this.onUpdateWorkflowProperties}
        onToggleAddFolderDialog={this.onToggleAddFolderDialog}
        onToggleCurrentFolderDialog={this.onToggleCurrentFolderDialog}
      />
    );
  };

  render() {
    const { pendingTasksCount, errorMsg, isListDialogShow, isListViewShow, currentFolder,
      isShowAddFolderDialog, isShowWorkflowFolderDialog, isShowWorkflowFolderView } = this.state;
    const { workflowTask } = this.props;
    if (errorMsg) {
      return (
        <div className="main-panel-center">
          <div className="cur-view-container">
            <div className="cur-view-content">
              <p className="error text-center">{errorMsg}</p>
            </div>
          </div>
        </div>
      );
    }

    let mainPanelWorkflowsPanelDom = (
      <div className={`main-panel-center main-panel-workflow ${isDesktop ? '' : 'mobile-main-panel-workflow'}`}>
        <div className="cur-view-container">
          <div className="cur-view-content" ref={ref => this.curViewContent = ref}>
            <MediaQuery query="(max-width: 767.8px)">
              <WorkflowNotification />
            </MediaQuery>
            <div ref={ref => this.workflowContainer = ref}>
              {this.renderHeader()}
              <div className="main-panel-workflow-todo">
                <div className="workflow-todo-title">{gettext('My todo list')}</div>
                <div
                  className="workflow-todo-content d-flex justify-content-center"
                  onClick={this.toggleTodoList.bind(this, TASK_TYPE.PENDING)}
                >
                  <div className="workflow-todo-image-container d-flex justify-content-center align-items-center">
                    <img
                      src={mediaUrl + 'img/my-todo-list.png'}
                      className="workflow-todo-image"
                      alt={gettext('Todo list')}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="workflow-todo-count-container d-flex">
                    <span className="workflow-todo-count-title">{gettext('Todo list')}</span>
                    <span className="workflow-todo-count">{pendingTasksCount}</span>
                  </div>
                </div>
              </div>
              <div className="main-panel-my-workflows">
                {this.renderContent()}
              </div>
            </div>
          </div>
        </div>
        {isListDialogShow && (
          <WorkflowTodoListDialog
            ref={this.workflowTaskListDialogRef}
            toggle={this.toggleTodoList}
            updatePendingTasksCount={this.updatePendingTasksCount}
          />
        )}
        {isListViewShow &&
          <ModalPortal>
            <WorkflowTaskListView
              pendingTasksCount={pendingTasksCount}
              workflowTask={workflowTask}
              eventBus={this.eventBus}
              toggle={this.toggleTodoList}
              updatePendingTasksCount={this.updatePendingTasksCount}
              clearWorkflowState={this.props.clearWorkflowState}
            />
          </ModalPortal>
        }
        {isShowAddFolderDialog && (
          <AddFolderDialog
            folderType={this.state.folderType}
            onAddFolder={this.onAddFolder}
            onToggleAddFolderDialog={this.onToggleAddFolderDialog}
          />
        )}
        {isShowWorkflowFolderDialog && (
          this.renderWorkflowDialog()
        )}
        {isShowWorkflowFolderView &&
          <WorkflowFolderView
            currentFolder={currentFolder}
            onToggleCurrentFolderView={this.onToggleCurrentFolderView}
            refreshPendingtasksCount={this.refreshPendingtasksCount}
          />
        }
      </div>
    );

    return (
      <I18nextProvider i18n={i18n}>
        {mainPanelWorkflowsPanelDom}
      </I18nextProvider>
    );
  }
}

MainPanelWorkflowsPanel.defaultProps = {
  isShowHeader: true
};

MainPanelWorkflowsPanel.propTypes = {
  isShowHeader: PropTypes.bool,
  workflowTag: PropTypes.string,
  workflowTask: PropTypes.object,
  clearWorkflowState: PropTypes.func,
};

export default MainPanelWorkflowsPanel;
