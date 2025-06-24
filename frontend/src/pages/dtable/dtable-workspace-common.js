import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { DropTarget } from 'react-dnd';
import { toaster } from 'dtable-ui-component';
import { seaQAAPI } from '../../api/web-api';
import Loading from '../../components/loading';
import TableAPITokenDialog from './dialog/table-api-token-dialog';
import ManageMembersDialog from './dialog/manage-members-dialog';
import RenameGroupNameDialog from './dialog/rename-group-name-dialog';
import TableSnapshotsDialog from './dialog/table-snapshots-dialog';
import CommonOperationConfirmationDialog from '../../components/dialog/common-operation-confirmation-dialog';
import GroupInviteMembersDialog from './dialog/group-invite-members-dialog';
import { Utils, validateName } from '../../utils/utils';
import { compareTwoString } from './utils/compare-two-string';
import { canAddProject, disableAddingPersonalBases } from '../../constants/config';
import DTableWorkspaceMemberDialog from './dialog/dtable-workspace-member-dialog';
import TransferGroupDialog from './dialog/transfer-group-dialog';
import AddBaseDropdownMenu from './dtable-dropdown-menu/add-base-dropdown';
import WebhookDialog from './dialog/webhook-dialog';
import MobileAddBase from './mobile/mobile-add-base';
import MobileShareTable from './mobile/mobile-share-table';
import ModalPortal from '../../components/modal-portal';
import RenameBaseView from './mobile/rename-base-view';
import MoveTableDialog from './dialog/move-table-dialog';
import Base from './model/base';
import html5DragDropContext from '../../utils/html5DragDropContext';
import WorkspaceHeader from './dtable-workspace-header';
import WorkspaceContainer from './dtable-workspace-container';
import LeaveGroupDialog from './dialog/leave-group-dialog';
import DepartmentDetailDialog from './dialog/department-detail-dialog';
import DTableSetPasswordDialog from './dialog/dtable-password/dtable-set-password-dialog';
import DTableModifyPasswordDialog from './dialog/dtable-password/dtable-modify-password-dialog';
import DTableUnsetPasswordDialog from './dialog/dtable-password/dtable-unset-password-dialog';
import GroupTrashDialog from './dialog/group-trash-dialog';
import FolderItemsDialog from './dtable-popover/folder-items-dialog';
import MobileFolderItems from './dtable-popover/folder-items-mobile';
import DTableWorkspaceDepartmentV2MemberDialog from './dialog/dtable-workspace-department-v2-member-dialog';

const containerTarget = {
  drop(props, monitor) {
    const optionSource = monitor.getItem();
    const draggedTable = optionSource.data;
    const dropFolder = props.folder;
    const dragFolder = optionSource.folder;
    if (dragFolder) {
      props.moveTableToFolder(draggedTable, dropFolder, dragFolder);
    }
  },
  // 1、from folder table to root container, can drop
  // 2、from root table and to root container, can not drop
  canDrop(props, monitor) {
    const optionSource = monitor.getItem();
    return !!optionSource.folder;
  },
};

const dropCollect = (connect, monitor) => ({
  connectDropTarget: connect.dropTarget(),
  isOver: monitor.isOver(),
  canDrop: monitor.canDrop(),
});

const gettext = window.gettext;
const username = window.app.pageOptions.username;

const propTypes = {
  workspace: PropTypes.object.isRequired,
  renameGroupName: PropTypes.func,
  onDeleteGroup: PropTypes.func,
  onCopyDTable: PropTypes.func.isRequired,
  onDeleteTable: PropTypes.func.isRequired,
  onLeaveGroupSharedTable: PropTypes.func,
  onAddGroupSharedTable: PropTypes.func,
  onLeaveGroupSharedView: PropTypes.func,
  onStarDTable: PropTypes.func,
  onUnstarDTable: PropTypes.func,
  onAddDTable: PropTypes.func,
  loadWorkspaceList: PropTypes.func,
  noBaseTip: PropTypes.object
};

class DTableWorkspaceCommon extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      projectList: [],
      folders: [],
      isDataLoading: true,
      isItemFreezed: false,
      isShowDeleteDialog: false,
      isShowSharedDialog: false,
      isShowSetPasswordDialog: false,
      isShowUnsetPasswordDialog: false,
      isShowModifyPasswordDialog: false,
      isShowAPITokenDialog: false,
      isShowWebhookDialog: false,
      isShowRenameTableDialog: false,
      isShowManageMembersDialog: false,
      isShowDepartmentDetailDialog: false,
      isShowTableSnapshotsDialog: false,
      isShowCopyDTable: false,
      isOwner: false,
      isAdmin: false,
      currentTable: null,
      currentFolder: null,
      toBeMovedItem: null,
      isShowGroupMember: false,
      isShowTransferGroupDialog: false,
      isShowTemplateList: false,
      isCreatedTemplateLoading: false,
      isShowVirtualDtable: false,
      isShowInviteDialog: false,
      isShowTrashDialog: false,
      isShowMobileShareTable: false,
      isShowMobileRenameView: false,
      isShowFolderOpen: false,
      isShowVirtualFolder: false,
      isShowMovingDialog: false,
      isParsing: false,
    };
    this.isDropdownOpen = false;
    this.isDesktop = Utils.isDesktop();
  }

  componentDidMount() {
    const { workspace } = this.props;
    const { folders, projectList } = this.getSortedWorkspaceContent(workspace);
    this.setState({ projectList, folders, isDataLoading: false });
    this.setWorkspaceAdminState(workspace);
  }

  setWorkspaceAdminState = (workspace) => {
    let isPersonal = workspace.type === 'personal';
    if (isPersonal) {
      this.setState({
        isOwner: true,
        isAdmin: true,
      });
    } else {
      this.setState({
        isOwner: workspace.group_owner === username,
        isAdmin: workspace.is_admin,
      });
    }
  };

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.workspace !== this.props.workspace) {
      const { workspace } = nextProps;
      const { folders, projectList } = this.getSortedWorkspaceContent(workspace);
      this.setState({ projectList, folders });
      this.setWorkspaceAdminState(nextProps.workspace);
    }
  }

  getSortedWorkspaceContent = (workspace) => {
    let { folders = [], project_list = [] } = workspace || {};
    return {
      folders: folders.sort((a, b) => compareTwoString(a.name, b.name)),
      projectList: project_list.sort((a, b) => compareTwoString(a.name, b.name)),
    };
  };

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  onDeleteTableToggle = (table) => {
    this.setState({
      isShowDeleteDialog: !this.state.isShowDeleteDialog,
      currentTable: table
    });
    this.onUnfreezedItem();
  };

  onDeleteDTable = () => {
    let tableName = this.state.currentTable.name;
    this.deleteTable(tableName);
    this.onDeleteTableToggle();
  };

  onShareTableToggle = (table) => {
    this.setState({
      isShowSharedDialog: !this.state.isShowSharedDialog,
      currentTable: table
    });
    this.onUnfreezedItem();
  };

  onSetPasswordToggle = (table) => {
    this.setState({
      isShowSetPasswordDialog: !this.state.isShowSetPasswordDialog,
      currentTable: table
    });
    this.onUnfreezedItem();
  };

  onUnsetPasswordToggle = (table) => {
    this.setState({
      isShowUnsetPasswordDialog: !this.state.isShowUnsetPasswordDialog,
      currentTable: table
    });
    this.onUnfreezedItem();
  };

  onModifyPasswordToggle = (table) => {
    this.setState({
      isShowModifyPasswordDialog: !this.state.isShowModifyPasswordDialog,
      currentTable: table
    });
    this.onUnfreezedItem();
  };

  onMobileShareTableToggle = (table) => {
    this.setState({
      isShowMobileShareTable: !this.state.isShowMobileShareTable,
      currentTable: table
    });
  };

  onMobileUpdateTableToggle = (table) => {
    this.setState({
      isShowMobileRenameView: !this.state.isShowMobileRenameView,
      currentTable: table
    });
  };

  hideMobileShareTable = (table) => {
    this.setState({
      isShowMobileShareTable: false,
      currentTable: table
    });
  };

  onTableAPITokenToggle = (table) => {
    this.setState({
      isShowAPITokenDialog: !this.state.isShowAPITokenDialog,
      currentTable: table
    });
    this.onUnfreezedItem();
  };

  onWebhookToggle = (table) => {
    this.setState({
      isShowWebhookDialog: !this.state.isShowWebhookDialog,
      currentTable: table
    });
  };

  onCreateProject = (tableName, owner, dtableIcon, dtableColor) => {
    seaQAAPI.createProject(tableName, owner, dtableIcon, dtableColor).then((res) => {
      this.state.projectList.push(res.data.project);
      this.setState({
        projectList: this.state.projectList
      });
    }).catch((error) => {
      this.handleError(error);
    });
  };

  createProjectInFolder = (projectName, email, dtableIcon, dtableColor, folder) => {
    seaQAAPI.createProject(projectName, email, dtableIcon, dtableColor, null, folder.id).then((res) => {
      let newProject = new Base(res.data.project);
      this.createBlankTable(newProject, folder);
    }).catch((error) => {
      this.handleError(error);
    });
  };

  handleError = (error) => {
    if (error && error.response && error.response.status === 500) {
      const error_msg = error.response.data ? error.response.data['error_msg'] : null;
      if (error_msg && error_msg !== 'Internal Server Error') {
        toaster.danger(error_msg);
      } else {
        toaster.danger(gettext('Internal Server Error.'));
      }
    } else {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    }
  };

  createBlankTable = (project, folder) => {
    let { projectList, folders } = this.state;
    let newProjectList = projectList.slice(0);
    newProjectList.push(project);
    if (!folder) {
      this.setState({ isShowVirtualDtable: false, projectList: newProjectList });
    } else {
      let newFolders = folders.slice(0);
      newFolders.forEach(item => {
        if (folder.id === item.id) {
          item.items.push({
            folder_id: folder.id,
            item_type: 'project',
            item_id: project.uuid
          });
        }
      });
      this.setState({ projectList: newProjectList, folders: newFolders });
    }
  };

  deleteTable = (projectName) => {
    let workspaceID = this.props.workspace.id;
    seaQAAPI.deleteTable(workspaceID, projectName).then(() => {
      let projectList = this.state.projectList.filter(project => {
        return project.name !== projectName;
      });
      this.setState({ projectList: projectList });
      this.props.onDeleteTable(workspaceID, projectList);
    }).catch((error) => {
      this.handleError(error);
    });
  };

  renameTable = (oldProjectName, newTableName) => {
    let response = validateName(newTableName);
    if (!response.isValid) {
      toaster.danger(response.message);
      this.forceUpdate();
      return;
    }
    let workspaceID = this.props.workspace.id;
    seaQAAPI.renameTable(workspaceID, oldProjectName, response.message).then((res) => {
      let projectList = this.state.projectList.map((project) => {
        if (project.name === oldProjectName) {
          project = res.data.project;
        }
        return project;
      });
      this.setState({ projectList: projectList });
    }).catch((error) => {
      this.handleError(error);
      // 400 error: base name invalid, new base name invalid, new base name is too long
      // forceUpdate to make sure error name disappear
      if (error && error.response && error.response.status === 400) {
        this.forceUpdate();
      }
    });
  };

  onUpdateTable = (projectName, updated) => {
    seaQAAPI.updateTable(this.props.workspace.id, projectName, updated).then((res) => {
      const updateProject = res.data.project;
      let projectList = this.state.projectList.map((project) => {
        if (project.name === projectName) {
          project = Object.assign({}, project, updateProject);
        }
        return project;
      });
      this.setState({ projectList: projectList });
    }).catch((error) => {
      this.handleError(error);
    });
  };

  formatMsgByOperation = (operation) => {
    if (operation === 'password_modify') {
      return gettext('Successfully modified password');
    }
  };

  onHandlePassword = (projectName, operation, password, newPassword, code) => {
    seaQAAPI.updateDTablePassword(this.props.workspace.id, projectName, operation, password, newPassword, code).then((res) => {
      this.props.loadWorkspaceList();
      const updateProject = res.data.project;
      let projectList = this.state.projectList.map((project) => {
        if (project.name === projectName) {
          project = Object.assign({}, project, updateProject);
        }
        return project;
      });
      this.setState({ projectList: projectList });
      let msg = this.formatMsgByOperation(operation);
      this.passwordRef.toggle();
      msg && toaster.success(msg);
    }).catch((error) => {
      let errMsg = Utils.getErrorMsg(error);
      this.passwordRef.setState({ errorInfo: errMsg });
    });
  };

  onCopyDTableToggle = (table) => {
    this.setState({
      isShowCopyDTable: !this.state.isShowCopyDTable,
      currentTable: table
    });
    this.onUnfreezedItem();
  };

  toggleManageMembersDialog = () => {
    this.setState({
      isShowManageMembersDialog: !this.state.isShowManageMembersDialog
    });
  };

  toggleDepartmentDetailDialog = () => {
    this.setState({
      isShowDepartmentDetailDialog: !this.state.isShowDepartmentDetailDialog
    });
  };

  onDtableManageMembers = () => {
    seaQAAPI.getGroup(this.props.workspace.group_id).catch(error => {
      this.handleError(error);
    });
  };

  onRenameDtableGroupToggle = () => {
    this.setState({
      isShowRenameTableDialog: !this.state.isShowRenameTableDialog
    });
  };

  onTableSnapshotsToggle = (table) => {
    this.setState({
      isShowTableSnapshotsDialog: !this.state.isShowTableSnapshotsDialog,
      currentTable: table,
    });
  };

  onTransferGroupToggle = () => {
    this.setState({ isShowTransferGroupDialog: !this.state.isShowTransferGroupDialog });
  };

  onDeleteGroupToggle = () => {
    this.setState({
      isShowDeleteGroupDialog: !this.state.isShowDeleteGroupDialog
    });
    this.onUnfreezedItem();
  };

  onLeaveGroupToggle = () => {
    this.setState({
      isShowLeaveGroupDialog: !this.state.isShowLeaveGroupDialog
    });
    this.onUnfreezedItem();
  };

  onDeleteGroupSubmit = () => {
    this.onDeleteGroup();
    this.onDeleteGroupToggle();
  };

  onLeaveGroupSubmit = () => {
    this.onLeaveGroup();
    this.onLeaveGroupToggle();
  };

  onDeleteGroup = () => {
    let groupID = this.props.workspace.group_id;
    if (groupID && this.state.projectList.length > 0) {
      toaster.danger(gettext('Cannot delete group with bases'));
      return;
    }
    seaQAAPI.deleteGroup(groupID).then(() => {
      toaster.success(gettext('Group deleted'));
      this.props.onDeleteGroup(groupID);
    }).catch((error) => {
      this.handleError(error);
    });
  };

  onLeaveGroup = () => {
    let groupID = this.props.workspace.group_id;
    seaQAAPI.deleteGroupMember(groupID, username).then((res) => {
      toaster.success(gettext('Successfully left group'));
      this.props.onDeleteGroup(groupID);
    }).catch(error => {
      this.handleError(error);
    });
  };

  onLeaveGroupSharedTable = (table) => {
    let { workspace } = this.props;
    seaQAAPI.deleteTableGroupShare(table.workspace_id, table.name, workspace.group_id).then(() => {
      this.props.onLeaveGroupSharedTable(workspace.group_id, table);
    }).catch((error) => {
      if (error.response && error.response.status === 404) {
        this.props.onLeaveGroupSharedTable(workspace.group_id, table);
      } else {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      }
    });
  };

  onLeaveGroupSharedView = (sharedView) => {
    let { workspace } = this.props;
    seaQAAPI.leaveGroupViewShare(sharedView.view_share_id).then(() => {
      this.props.onLeaveGroupSharedView(workspace.group_id, sharedView);
    }).catch((error) => {
      if (error.response && error.response.status === 404) {
        this.props.onLeaveGroupSharedView(workspace.group_id, sharedView);
      } else {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      }
    });
  };

  onShowTemplateListToggle = () => {
    this.setState({ isShowTemplateList: !this.state.isShowTemplateList });
  };

  showVirtualDtable = () => {
    this.setState({ isShowVirtualDtable: true });
  };

  hideVirtualDtable = () => {
    this.setState({ isShowVirtualDtable: false });
  };

  showVirtualFolder = () => {
    this.setState({ isShowVirtualFolder: true });
  };

  hideVirtualFolder = () => {
    this.setState({ isShowVirtualFolder: false });
  };

  createBlankFolder = (folder) => {
    let folders = this.state.folders.slice(0);
    folders.push(folder);
    this.setState({
      isShowVirtualFolder: false,
      folders: folders
    });
  };

  onUpdateFolderName = (folderID, folderName) => {
    seaQAAPI.updateFolder(this.props.workspace.id, folderID, folderName).then((res) => {
      let folder = res.data.folder;
      let folders = this.state.folders.slice(0);
      let folderIndex = folders.findIndex(folder => folder.id === folderID);
      folders.splice(folderIndex, 1, Object.assign({}, folders[folderIndex], folder));
      this.setState({ folders });
      let { currentFolder } = this.state;
      if (currentFolder && currentFolder.id === folderID) {
        currentFolder = Object.assign({}, currentFolder, { name: folder.name });
        this.setState({ currentFolder });
      }
    }).catch((error) => {
      this.handleError(error);
    });
  };

  renderAddTableItem = () => {
    const { workspace } = this.props;
    const isPersonal = workspace.type === 'personal';
    let { isItemFreezed } = this.state;
    if (isPersonal && disableAddingPersonalBases) {
      return null;
    }
    if (this.isDesktop) {
      return (
        <div className={`table-item ${isItemFreezed ? '' : 'add-table-range'}`}>
          <AddBaseDropdownMenu
            currentWorkspace={this.props.workspace}
            onCreateTableToggle={this.showVirtualDtable}
            onCreateFolderToggle={this.showVirtualFolder}
          />
        </div>
      );
    }
    return (
      <MobileAddBase
        currentWorkspace={this.props.workspace}
        createProject={this.onCreateProject}
        ref={ref => this.addBaseRef = ref}
        isCreatedTemplateLoading={this.state.isCreatedTemplateLoading}
        createBlankFolder={this.createBlankFolder}
      />
    );
  };

  onGroupMemberToggle = () => {
    this.setState({ isShowGroupMember: !this.state.isShowGroupMember });
  };

  openGroupMember = (e) => {
    e.stopPropagation();
    if (!this.state.isShowGroupMember) {
      this.setState({ isShowGroupMember: true });
    }
  };

  toggleGroupInviteDialog = () => {
    this.setState({
      isShowInviteDialog: !this.state.isShowInviteDialog
    });
  };

  toggleGroupTrashDialog = () => {
    this.setState({
      isShowTrashDialog: !this.state.isShowTrashDialog
    });
  };

  onFolderToggle = (event, folder) => {
    if (this.state.isShowFolderOpen) {
      this.setDropdownState(false);
    }
    const prevFolder = this.state.currentFolder;
    this.setState({
      isShowFolderOpen: !this.state.isShowFolderOpen,
      currentFolder: folder
    }, () => {
      const element = document.getElementById(`dtable-folder-name-${prevFolder?.id}`);
      if (element) element.focus();
    });
  };

  changeCurrentFolder = (folder, callback) => {
    this.setState({ currentFolder: folder }, () => {
      if (typeof callback === 'function') {
        callback();
      }
    });
  };

  onMoveFolderItemToggle = (toBeMovedItem) => {
    this.setState({
      toBeMovedItem: toBeMovedItem,
      isShowMovingDialog: !this.state.isShowMovingDialog
    });
  };

  /**
   * move table from root to folder, move table from folder to root, move table from one folder to other folder
   * @param {object} table the table being moved, is required
   * @param {object} dropFolder optional, if there is no dropFolder, move the table from the folder to the root directory
   * @param {object} dragFolder optional, if there is no dragFolder, move the table from the root directory to the folder
   */
  moveTableToFolder = (table, dropFolder, dragFolder) => {
    if (!table) return;
    let itemType = 'dtable';
    let itemId = table.uuid;
    if (table.view_share_id) {
      itemType = 'view_group_share';
      itemId = table.view_share_id;
    } else if (table.dtable_share_id) {
      itemType = 'dtable_group_share';
      itemId = table.dtable_share_id;
    }
    const toBeMovedItem = {
      table,
      item_type: itemType,
      item_id: itemId,
      folder_id: dragFolder ? dragFolder.id : '/',
    };
    this.setState({ toBeMovedItem }, () => {
      this.moveFolderItem(dragFolder ? dragFolder.id : '/', dropFolder ? dropFolder.id : '/');
    });
  };

  moveFolderItem = (from, to) => {
    let { workspace } = this.props;
    let { toBeMovedItem } = this.state;
    if (!toBeMovedItem) {
      return;
    }
    if (from === to) {
      return;
    }
    seaQAAPI.moveFolderItem(workspace.id, toBeMovedItem.item_type, toBeMovedItem.item_id, from, to).then(res => {
      let folders = this.state.folders.slice(0);
      if (from === '/') {
        folders.forEach(folder => {
          if (folder.id === to) {
            folder.items.push({
              item_type: toBeMovedItem.item_type,
              item_id: toBeMovedItem.item_id.toString(),
              folder_id: to
            });
          }
        });
      } else if (to === '/') {
        folders.forEach(folder => {
          if (folder.id === from) {
            folder.items = folder.items.filter(item => {
              return !(item.item_type === toBeMovedItem.item_type && item.item_id.toString() === toBeMovedItem.item_id.toString());
            });
          }
        });
      } else {
        let targetItem; let fromFolder; let toFolder;
        for (let i = 0; i < folders.length; i++) {
          if (folders[i].id === from) {
            fromFolder = folders[i];
            let targetItemIndex = fromFolder.items.findIndex(item => {
              return item.item_type === toBeMovedItem.item_type && item.item_id.toString() === toBeMovedItem.item_id.toString();
            });
            targetItem = fromFolder.items.splice(targetItemIndex, 1)[0];
          } else if (folders[i].id === to) {
            toFolder = folders[i];
          }
        }
        toFolder.items.push(targetItem);
      }
      this.setState({ folders: folders });
    }).catch(error => {
      this.handleError(error);
    });
  };

  deleteFolder = (folderID) => {
    seaQAAPI.deleteFolder(this.props.workspace.id, folderID).then(() => {
      let folders = this.state.folders.filter(folder => folder.id !== folderID);
      const { currentFolder } = this.state;
      if (currentFolder && currentFolder.id === folderID) {
        this.setState({
          folders,
          currentFolder: null,
        });
      } else {
        this.setState({ folders });
      }
    }).catch(error => {
      this.handleError(error);
    });
  };

  getDropdownState = () => {
    return this.isDropdownOpen;
  };

  setDropdownState = (state) => {
    this.isDropdownOpen = state;
  };

  renderEmpty = () => {
    if (this.state.projectList.length === 0 && this.state.folders.length === 0) {
      return this.props.noBaseTip || '';
    }
  };

  render() {
    const { workspace } = this.props;
    let groupSharedTables = [];
    const isPersonal = workspace.type === 'personal';
    let { projectList, folders, isItemFreezed, isDataLoading, isOwner, isAdmin, isShowFolderOpen, currentFolder } = this.state;
    if (isDataLoading) {
      return <Loading />;
    }
    if (workspace.type === 'group') {
      groupSharedTables = workspace.group_shared_dtables;
    }

    const isOwnerOrAdmin = !isPersonal && (isOwner || isAdmin);

    const isDepartV2 = !isPersonal && workspace.department_id;

    const DndWorkspaceContainer = DropTarget('Base', containerTarget, dropCollect)(WorkspaceContainer);
    return (
      <Fragment>
        <div className="workspace">
          <WorkspaceHeader
            workspace={workspace}
            isDesktop={this.isDesktop}
            isOwnerOrAdmin={isOwnerOrAdmin}
            isOwner={isOwner}
            openGroupMember={this.openGroupMember}
            onRenameDtableGroupToggle={this.onRenameDtableGroupToggle}
            toggleManageMembersDialog={this.toggleManageMembersDialog}
            onDtableManageMembers={this.onDtableManageMembers}
            onDeleteGroupToggle={this.onDeleteGroupToggle}
            onLeaveGroupToggle={this.onLeaveGroupToggle}
            onTransferGroupToggle={this.onTransferGroupToggle}
            toggleGroupInviteDialog={this.toggleGroupInviteDialog}
            toggleGroupTrashDialog={this.toggleGroupTrashDialog}
          />
          <DndWorkspaceContainer
            isDesktop={this.isDesktop}
            isOwnerOrAdmin={isOwnerOrAdmin}
            isPersonal={isPersonal}
            isOwner={isOwner}
            isAdmin={isAdmin}
            folders={folders}
            workspace={workspace}
            projectList={projectList}
            groupSharedTables={groupSharedTables}
            folder={currentFolder}
            canAddProject={canAddProject}
            isItemFreezed={isItemFreezed}
            onFolderToggle={this.onFolderToggle}
            createBlankTable={this.createBlankTable}
            onShowTemplateListToggle={this.onShowTemplateListToggle}
            onMoveFolderItemToggle={this.onMoveFolderItemToggle}
            moveFolderItem={this.moveFolderItem}
            renameTable={this.renameTable}
            onShareTableToggle={this.onShareTableToggle}
            onSetPasswordToggle={this.onSetPasswordToggle}
            onUnsetPasswordToggle={this.onUnsetPasswordToggle}
            onModifyPasswordToggle={this.onModifyPasswordToggle}
            onDeleteTableToggle={this.onDeleteTableToggle}
            onLeaveGroupToggle={this.onLeaveGroupToggle}
            onTableAPITokenToggle={this.onTableAPITokenToggle}
            onWebhookToggle={this.onWebhookToggle}
            onFreezedItem={this.onFreezedItem}
            onUnfreezedItem={this.onUnfreezedItem}
            onTableSnapshotsToggle={this.onTableSnapshotsToggle}
            onCopyDTableToggle={this.onCopyDTableToggle}
            onAddDTable={this.props.onAddDTable}
            onUpdateTable={this.onUpdateTable}
            onMobileShareTableToggle={this.onMobileShareTableToggle}
            onMobileUpdateTableToggle={this.onMobileUpdateTableToggle}
            onLeaveGroupSharedTable={this.onLeaveGroupSharedTable}
            onLeaveGroupSharedView={this.onLeaveGroupSharedView}
            createProjectInFolder={this.createProjectInFolder}
            renderAddTableItem={this.renderAddTableItem}
            moveTableToFolder={this.moveTableToFolder}
            isShowVirtualDtable={this.state.isShowVirtualDtable}
            isShowVirtualFolder={this.state.isShowVirtualFolder}
            openGroupMember={this.openGroupMember}
            onRenameDtableGroupToggle={this.onRenameDtableGroupToggle}
            toggleManageMembersDialog={this.toggleManageMembersDialog}
            onDtableManageMembers={this.onDtableManageMembers}
            onDeleteGroupToggle={this.onDeleteGroupToggle}
            onTransferGroupToggle={this.onTransferGroupToggle}
            toggleGroupInviteDialog={this.toggleGroupInviteDialog}
            deleteFolder={this.deleteFolder}
            onUpdateFolderName={this.onUpdateFolderName}
            hideVirtualDtable={this.hideVirtualDtable}
            createBlankFolder={this.createBlankFolder}
            hideVirtualFolder={this.hideVirtualFolder}
            setDropdownState={this.setDropdownState}
            getDropdownState={this.getDropdownState}
            onCopyDTable={this.props.onCopyDTable}
          />
        </div>
        {this.renderEmpty()}
        {this.state.isShowDeleteDialog && (
          <CommonOperationConfirmationDialog
            title={gettext('Delete base')}
            message={gettext('Are you sure you want to delete the base {placeholder} ?').replace('{placeholder}', `<b>${this.state.currentTable.name}</b>`)}
            executeOperation={this.onDeleteDTable}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.onDeleteTableToggle}
          />
        )}
        {this.state.isShowSetPasswordDialog &&
          <DTableSetPasswordDialog
            ref={ref => this.passwordRef = ref}
            dtable={this.state.currentTable}
            toggle={this.onSetPasswordToggle}
            onHandlePassword={this.onHandlePassword}
          />
        }
        {this.state.isShowModifyPasswordDialog &&
          <DTableModifyPasswordDialog
            ref={ref => this.passwordRef = ref}
            dtable={this.state.currentTable}
            toggle={this.onModifyPasswordToggle}
            onHandlePassword={this.onHandlePassword}
          />
        }
        {this.state.isShowUnsetPasswordDialog &&
          <DTableUnsetPasswordDialog
            ref={ref => this.passwordRef = ref}
            dtable={this.state.currentTable}
            toggle={this.onUnsetPasswordToggle}
            onHandlePassword={this.onHandlePassword}
          />
        }
        {this.state.isShowAPITokenDialog &&
          <TableAPITokenDialog
            currentTable={this.state.currentTable}
            onTableAPITokenToggle={this.onTableAPITokenToggle}
          />
        }
        {this.state.isShowWebhookDialog &&
          <WebhookDialog
            currentTable={this.state.currentTable}
            onWebhookToggle={this.onWebhookToggle}
          />
        }
        {this.state.isShowRenameTableDialog &&
          <RenameGroupNameDialog
            onRenameDtableGroupToggle={this.onRenameDtableGroupToggle}
            currentGroupName={workspace.name}
            groupID={workspace.group_id}
            renameGroupName={this.props.renameGroupName}
          />
        }
        {this.state.isShowManageMembersDialog &&
          <ManageMembersDialog
            groupID={workspace.group_id}
            toggleManageMembersDialog={this.toggleManageMembersDialog}
            isOwner={this.state.isOwner}
            isAdmin={this.state.isAdmin}
            loadWorkspaceList={this.props.loadWorkspaceList}
            toggleDepartmentDetailDialog={this.toggleDepartmentDetailDialog}
          />
        }
        {this.state.isShowDepartmentDetailDialog &&
          <DepartmentDetailDialog
            groupID={workspace.group_id}
            toggleManageMembersDialog={this.toggleManageMembersDialog}
            isOwner={this.state.isOwner}
            isAdmin={this.state.isAdmin}
            loadWorkspaceList={this.props.loadWorkspaceList}
            toggleDepartmentDetailDialog={this.toggleDepartmentDetailDialog}
            usedFor='add_group_member'
          />
        }
        {this.state.isShowTransferGroupDialog &&
          <TransferGroupDialog
            groupID={workspace.group_id}
            toggleTransferGroupDialog={this.onTransferGroupToggle}
            loadWorkspaceList={this.props.loadWorkspaceList}
          />
        }
        {this.state.isShowTableSnapshotsDialog && (
          <TableSnapshotsDialog
            workspace={this.props.workspace}
            dtable={this.state.currentTable}
            toggleCancel={this.onTableSnapshotsToggle}
            onAddDTable={this.props.onAddDTable}
          />
        )}
        {this.state.isShowDeleteGroupDialog && (
          <CommonOperationConfirmationDialog
            title={gettext('Delete group')}
            message={gettext('Are you sure you want to delete group {placeholder} ?').replace('{placeholder}', `<b>${this.props.workspace.name}</b>`)}
            executeOperation={this.onDeleteGroupSubmit}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.onDeleteGroupToggle}
          />
        )}
        {this.state.isShowLeaveGroupDialog && (
          <LeaveGroupDialog
            currentWorkspace={this.props.workspace}
            leaveCancel={this.onLeaveGroupToggle}
            handleSubmit={this.onLeaveGroupSubmit}
            workspace={this.props.workspace}
          />
        )}
        {this.state.isShowInviteDialog && (
          <GroupInviteMembersDialog
            workspace={workspace}
            toggleGroupInviteDialog={this.toggleGroupInviteDialog}
          />
        )}
        {this.state.isShowGroupMember && !isDepartV2 && (
          <DTableWorkspaceMemberDialog
            workspace={workspace}
            onGroupMemberToggle={this.onGroupMemberToggle}
          />
        )}
        {this.state.isShowGroupMember && isDepartV2 && (
          <DTableWorkspaceDepartmentV2MemberDialog
            workspace={workspace}
            onGroupMemberToggle={this.onGroupMemberToggle}
          />
        )}
        {this.state.isShowMobileShareTable &&
          <ModalPortal>
            <MobileShareTable
              hideMobileShareTable={this.hideMobileShareTable}
              currentTable={this.state.currentTable}
            />
          </ModalPortal>
        }
        {this.state.isShowMobileRenameView &&
          <ModalPortal>
            <RenameBaseView
              onMobileUpdateItemToggle={this.onMobileUpdateTableToggle}
              currentItem={this.state.currentTable}
              onUpdateItem={this.onUpdateTable}
            />
          </ModalPortal>
        }
        {this.isDesktop && isShowFolderOpen &&
          <FolderItemsDialog
            workspace={workspace}
            folders={folders}
            projectList={projectList}
            groupSharedTables={groupSharedTables}
            folder={this.state.currentFolder}
            onFolderToggle={this.onFolderToggle}
            onLeaveGroupSharedTable={this.onLeaveGroupSharedTable}
            onLeaveGroupSharedView={this.onLeaveGroupSharedView}
            changeCurrentFolder={this.changeCurrentFolder}
            createBlankTable={this.createBlankTable}
            createBlankFolder={this.createBlankFolder}
            onShowTemplateListToggle={this.onShowTemplateListToggle}
            onMoveFolderItemToggle={this.onMoveFolderItemToggle}
            moveFolderItem={this.moveFolderItem}
            renameTable={this.renameTable}
            onShareTableToggle={this.onShareTableToggle}
            onSetPasswordToggle={this.onSetPasswordToggle}
            onUnsetPasswordToggle={this.onUnsetPasswordToggle}
            onModifyPasswordToggle={this.onModifyPasswordToggle}
            onDeleteTableToggle={this.onDeleteTableToggle}
            onTableAPITokenToggle={this.onTableAPITokenToggle}
            onWebhookToggle={this.onWebhookToggle}
            onFreezedItem={this.onFreezedItem}
            onUnfreezedItem={this.onUnfreezedItem}
            onTableSnapshotsToggle={this.onTableSnapshotsToggle}
            onCopyDTableToggle={this.onCopyDTableToggle}
            isOwner={isOwner}
            isAdmin={isAdmin}
            onAddDTable={this.props.onAddDTable}
            onUpdateTable={this.onUpdateTable}
            onMobileShareTableToggle={this.onMobileShareTableToggle}
            onMobileUpdateTableToggle={this.onMobileUpdateTableToggle}
            canAddProject={canAddProject}
            createProjectInFolder={this.createProjectInFolder}
            setDropdownState={this.setDropdownState}
            getDropdownState={this.getDropdownState}
            deleteFolder={this.deleteFolder}
            onUpdateFolderName={this.onUpdateFolderName}
            moveTableToFolder={this.moveTableToFolder}
            onCopyDTable={this.props.onCopyDTable}
          />
        }
        {!this.isDesktop && isShowFolderOpen &&
          <MobileFolderItems
            workspace={workspace}
            tableList={projectList}
            groupSharedTables={groupSharedTables}
            folder={this.state.currentFolder}
            onLeaveGroupSharedTable={this.onLeaveGroupSharedTable}
            onLeaveGroupSharedView={this.onLeaveGroupSharedView}
            onFolderToggle={this.onFolderToggle}
            createBlankTable={this.createBlankTable}
            onShowTemplateListToggle={this.onShowTemplateListToggle}
            onMoveFolderItemToggle={this.onMoveFolderItemToggle}
            moveFolderItem={this.moveFolderItem}
            renameTable={this.renameTable}
            onShareTableToggle={this.onShareTableToggle}
            onSetPasswordToggle={this.onSetPasswordToggle}
            onUnsetPasswordToggle={this.onUnsetPasswordToggle}
            onModifyPasswordToggle={this.onModifyPasswordToggle}
            onDeleteTableToggle={this.onDeleteTableToggle}
            onTableAPITokenToggle={this.onTableAPITokenToggle}
            onWebhookToggle={this.onWebhookToggle}
            onFreezedItem={this.onFreezedItem}
            onUnfreezedItem={this.onUnfreezedItem}
            onTableSnapshotsToggle={this.onTableSnapshotsToggle}
            onCopyDTableToggle={this.onCopyDTableToggle}
            isOwner={isOwner}
            isAdmin={isAdmin}
            onAddDTable={this.props.onAddDTable}
            onUpdateTable={this.onUpdateTable}
            onMobileShareTableToggle={this.onMobileShareTableToggle}
            onMobileUpdateTableToggle={this.onMobileUpdateTableToggle}
            canAddProject={canAddProject}
            createProjectInFolder={this.createProjectInFolder}
            setDropdownState={this.setDropdownState}
            getDropdownState={this.getDropdownState}
          />
        }
        {this.state.isShowMovingDialog &&
          <MoveTableDialog
            folders={this.state.folders}
            toBeMovedItem={this.state.toBeMovedItem}
            moveFolderItem={this.moveFolderItem}
            onMoveFolderItemToggle={this.onMoveFolderItemToggle}
          />
        }
        {this.state.isShowTrashDialog && (
          <GroupTrashDialog
            groupID={workspace.group_id}
            toggleGroupTrashDialog={this.toggleGroupTrashDialog}
            loadWorkspaceList={this.props.loadWorkspaceList}
            isDesktop={this.isDesktop}
          />
        )}
      </Fragment>
    );
  }
}


DTableWorkspaceCommon.propTypes = propTypes;

const DndOptionsContainer = DropTarget('Base', {}, connect => ({
  connectDropTarget: connect.dropTarget()
}))(DTableWorkspaceCommon);

export default html5DragDropContext(DndOptionsContainer);
