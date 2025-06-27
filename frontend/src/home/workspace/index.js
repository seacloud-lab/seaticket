import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { seaQAAPI } from '../../api/web-api';
import Loading from '../../components/loading';
import ManageMembersDialog from '../dialog/manage-members-dialog';
import RenameGroupNameDialog from '../dialog/rename-group-name-dialog';
import CommonOperationConfirmationDialog from '../../components/dialog/common-operation-confirmation-dialog';
import GroupInviteMembersDialog from '../dialog/group-invite-members-dialog';
import { Utils, validateName } from '../../utils/utils';
import { compareTwoString } from '../utils/compare-two-string';
import { canAddProject, disableAddingPersonalBases } from '../../constants';
import WorkspaceMemberDialog from '../dialog/workspace-member-dialog';
import TransferGroupDialog from '../dialog/transfer-group-dialog';
import MobileAddBase from '../mobile/mobile-add-base';
import MobileShareTable from '../mobile/mobile-share-table';
import ModalPortal from '../../components/modal-portal';
import RenameBaseView from '../mobile/rename-base-view';
import Header from './header';
import Body from './body';
import LeaveGroupDialog from '../dialog/leave-group-dialog';
import DepartmentDetailDialog from '../dialog/department-detail-dialog';
import GroupTrashDialog from '../dialog/group-trash-dialog';
import WorkspaceDepartmentV2MemberDialog from '../dialog/workspace-department-v2-member-dialog';

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
  onAddDTable: PropTypes.func,
  loadWorkspaceList: PropTypes.func,
  noBaseTip: PropTypes.object
};

class Workspace extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      projectList: [],
      isDataLoading: true,
      isItemFreezed: false,
      isShowDeleteDialog: false,
      isShowSharedDialog: false,
      isShowRenameTableDialog: false,
      isShowManageMembersDialog: false,
      isShowDepartmentDetailDialog: false,
      isShowCopyDTable: false,
      isOwner: false,
      isAdmin: false,
      currentTable: null,
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
      isShowMovingDialog: false,
      isParsing: false,
    };
    this.isDropdownOpen = false;
    this.isDesktop = Utils.isDesktop();
  }

  componentDidMount() {
    const { workspace } = this.props;
    const { projectList } = this.getSortedWorkspaceContent(workspace);
    this.setState({ projectList, isDataLoading: false });
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
      const { projectList } = this.getSortedWorkspaceContent(workspace);
      this.setState({ projectList });
      this.setWorkspaceAdminState(nextProps.workspace);
    }
  }

  getSortedWorkspaceContent = (workspace) => {
    let { project_list = [] } = workspace || {};
    return {
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

  onCreateProject = (tableName, owner, icon, bgColor) => {
    seaQAAPI.createProject(tableName, owner, icon, bgColor).then((res) => {
      this.state.projectList.push(res.data.project);
      this.setState({
        projectList: this.state.projectList
      });
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

  createBlankTable = (project) => {
    let { projectList } = this.state;
    let newProjectList = projectList.slice(0);
    newProjectList.push(project);
    this.setState({ isShowVirtualDtable: false, projectList: newProjectList });
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

  renderAddTableItem = () => {
    const { workspace } = this.props;
    const isPersonal = workspace.type === 'personal';
    let { isItemFreezed } = this.state;
    if (isPersonal && disableAddingPersonalBases) {
      return null;
    }
    if (this.isDesktop) {
      return (
        <div className={`table-item ${isItemFreezed ? '' : 'add-table-range'}`} onClick={this.showVirtualDtable}>
          <div className="table-item-wrapper ml-0">
            <div className="table-icon" aria-hidden="true">
              <span className="table-icon-content">
                <i className="project-icon icon-add project-icon-style"></i>
              </span>
            </div>
            <div className="table-name">
              <span className="a-simulate">{gettext('Add a blank project')}</span>
            </div>
          </div>

        </div>
      );
    }
    return (
      <MobileAddBase
        currentWorkspace={this.props.workspace}
        createProject={this.onCreateProject}
        ref={ref => this.addBaseRef = ref}
        isCreatedTemplateLoading={this.state.isCreatedTemplateLoading}
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

  getDropdownState = () => {
    return this.isDropdownOpen;
  };

  setDropdownState = (state) => {
    this.isDropdownOpen = state;
  };

  renderEmpty = () => {
    if (this.state.projectList.length === 0) {
      return this.props.noBaseTip || '';
    }
  };

  render() {
    const { workspace } = this.props;
    let groupSharedTables = [];
    const isPersonal = workspace.type === 'personal';
    let { projectList, isItemFreezed, isDataLoading, isOwner, isAdmin } = this.state;
    if (isDataLoading) {
      return <Loading />;
    }
    if (workspace.type === 'group') {
      groupSharedTables = workspace.group_shared_dtables;
    }

    const isOwnerOrAdmin = !isPersonal && (isOwner || isAdmin);

    const isDepartV2 = !isPersonal && workspace.department_id;

    return (
      <Fragment>
        <div className="workspace">
          <Header
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
          <Body
            isDesktop={this.isDesktop}
            isOwnerOrAdmin={isOwnerOrAdmin}
            isPersonal={isPersonal}
            isOwner={isOwner}
            isAdmin={isAdmin}
            workspace={workspace}
            projectList={projectList}
            groupSharedTables={groupSharedTables}
            canAddProject={canAddProject}
            isItemFreezed={isItemFreezed}
            isShowVirtualDtable={this.state.isShowVirtualDtable}
            createBlankTable={this.createBlankTable}
            onShowTemplateListToggle={this.onShowTemplateListToggle}
            renameTable={this.renameTable}
            onShareTableToggle={this.onShareTableToggle}
            onDeleteTableToggle={this.onDeleteTableToggle}
            onLeaveGroupToggle={this.onLeaveGroupToggle}
            onFreezedItem={this.onFreezedItem}
            onUnfreezedItem={this.onUnfreezedItem}
            onCopyDTableToggle={this.onCopyDTableToggle}
            onAddDTable={this.props.onAddDTable}
            onUpdateTable={this.onUpdateTable}
            onMobileShareTableToggle={this.onMobileShareTableToggle}
            onMobileUpdateTableToggle={this.onMobileUpdateTableToggle}
            onLeaveGroupSharedTable={this.onLeaveGroupSharedTable}
            onLeaveGroupSharedView={this.onLeaveGroupSharedView}
            renderAddTableItem={this.renderAddTableItem}
            openGroupMember={this.openGroupMember}
            onRenameDtableGroupToggle={this.onRenameDtableGroupToggle}
            toggleManageMembersDialog={this.toggleManageMembersDialog}
            onDtableManageMembers={this.onDtableManageMembers}
            onDeleteGroupToggle={this.onDeleteGroupToggle}
            onTransferGroupToggle={this.onTransferGroupToggle}
            toggleGroupInviteDialog={this.toggleGroupInviteDialog}
            hideVirtualDtable={this.hideVirtualDtable}
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
          <WorkspaceMemberDialog
            workspace={workspace}
            onGroupMemberToggle={this.onGroupMemberToggle}
          />
        )}
        {this.state.isShowGroupMember && isDepartV2 && (
          <WorkspaceDepartmentV2MemberDialog
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


Workspace.propTypes = propTypes;

export default Workspace;
