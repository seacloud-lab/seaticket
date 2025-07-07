import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster, Loading, CommonOperationConfirmationDialog } from '../../components';
import { seaQAAPI } from '../../api/web-api';
import ManageMembersDialog from '../dialog/manage-members-dialog';
import RenameGroupNameDialog from '../dialog/rename-group-name-dialog';
import GroupInviteMembersDialog from '../dialog/group-invite-members-dialog';
import { Utils } from '../../utils/utils';
import { compareTwoString } from '../utils/compare-two-string';
import { canAddProject, disableAddingPersonalProjects } from '../../constants';
import WorkspaceMemberDialog from '../dialog/workspace-member-dialog';
import TransferGroupDialog from '../dialog/transfer-group-dialog';
import MobileAddProject from '../mobile/mobile-add-project';
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
  onCopyProject: PropTypes.func.isRequired,
  onDeleteProject: PropTypes.func.isRequired,
  onLeaveGroupSharedProject: PropTypes.func,
  onAddGroupSharedProject: PropTypes.func,
  onAddProject: PropTypes.func,
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
      currentProject: null,
      toBeMovedItem: null,
      isShowGroupMember: false,
      isShowTransferGroupDialog: false,
      isShowTemplateList: false,
      isCreatedTemplateLoading: false,
      isShowVirtualProject: false,
      isShowInviteDialog: false,
      isShowTrashDialog: false,
      isShowMobileShareProject: false,
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

  onDeleteProjectToggle = (project) => {
    this.setState({
      isShowDeleteDialog: !this.state.isShowDeleteDialog,
      currentProject: project
    });
    this.onUnfreezedItem();
  };

  onDeleteProject = () => {
    const name = this.state.currentProject.name;
    this.deleteProject(name);
    this.onDeleteProjectToggle();
  };

  onShareProjectToggle = (project) => {
    this.setState({
      isShowSharedDialog: !this.state.isShowSharedDialog,
      currentProject: project
    });
    this.onUnfreezedItem();
  };

  onMobileShareProjectToggle = (project) => {
    this.setState({
      isShowMobileShareProject: !this.state.isShowMobileShareProject,
      currentProject: project
    });
  };

  onMobileUpdateProjectToggle = (project) => {
    this.setState({
      isShowMobileRenameView: !this.state.isShowMobileRenameView,
      currentProject: project
    });
  };

  hideMobileShareProject = (project) => {
    this.setState({
      isShowMobileShareProject: false,
      currentProject: project
    });
  };

  onCreateProject = (name, owner, icon, bgColor) => {
    seaQAAPI.createProject(name, owner, icon, bgColor).then((res) => {
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

  createBlankProject = (project) => {
    let { projectList } = this.state;
    let newProjectList = projectList.slice(0);
    newProjectList.push(project);
    this.setState({ isShowVirtualProject: false, projectList: newProjectList });
  };

  deleteProject = (projectName) => {
    let workspaceID = this.props.workspace.id;
    seaQAAPI.deleteProject(workspaceID, projectName).then(() => {
      let projectList = this.state.projectList.filter(project => {
        return project.name !== projectName;
      });
      this.setState({ projectList: projectList });
      this.props.onDeleteProject(workspaceID, projectList);
    }).catch((error) => {
      this.handleError(error);
    });
  };

  onUpdateProject = (projectName, updated) => {
    seaQAAPI.updateProject(this.props.workspace.id, projectName, updated).then((res) => {
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

  onCopyProjectToggle = (project) => {
    this.setState({
      isShowCopyDTable: !this.state.isShowCopyDTable,
      currentProject: project
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

  onRenameGroupToggle = () => {
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

  onLeaveGroupSharedProject = (project) => {
    let { workspace } = this.props;
    seaQAAPI.deleteProjectGroupShare(project.workspace_id, project.name, workspace.group_id).then(() => {
      this.props.onLeaveGroupSharedProject(workspace.group_id, project);
    }).catch((error) => {
      if (error.response && error.response.status === 404) {
        this.props.onLeaveGroupSharedProject(workspace.group_id, project);
      } else {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      }
    });
  };

  onShowTemplateListToggle = () => {
    this.setState({ isShowTemplateList: !this.state.isShowTemplateList });
  };

  showVirtualProject = () => {
    this.setState({ isShowVirtualProject: true });
  };

  hideVirtualProject = () => {
    this.setState({ isShowVirtualProject: false });
  };

  renderAddItem = () => {
    const { workspace } = this.props;
    const isPersonal = workspace.type === 'personal';
    let { isItemFreezed } = this.state;
    if (isPersonal && disableAddingPersonalProjects) return null;
    if (this.isDesktop) {
      return (
        <div className={`project-item ${isItemFreezed ? '' : 'add-project-range'}`} onClick={this.showVirtualProject}>
          <div className="project-item-wrapper ml-0">
            <div className="project-icon" aria-hidden="true">
              <span className="project-icon-content">
                <i className="project-icon icon-add project-icon-style"></i>
              </span>
            </div>
            <div className="project-name">
              <span className="a-simulate">{gettext('Add a blank project')}</span>
            </div>
          </div>

        </div>
      );
    }
    return (
      <MobileAddProject
        currentWorkspace={this.props.workspace}
        createProject={this.onCreateProject}
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
    let groupSharedProjects = [];
    const isPersonal = workspace.type === 'personal';
    let { projectList, isItemFreezed, isDataLoading, isOwner, isAdmin } = this.state;
    if (isDataLoading) {
      return <Loading />;
    }
    if (workspace.type === 'group') {
      groupSharedProjects = workspace.group_shared_projects;
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
            onRenameGroupToggle={this.onRenameGroupToggle}
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
            groupSharedProjects={groupSharedProjects}
            canAddProject={canAddProject}
            isItemFreezed={isItemFreezed}
            isShowVirtualProject={this.state.isShowVirtualProject}
            createBlankProject={this.createBlankProject}
            onShowTemplateListToggle={this.onShowTemplateListToggle}
            onShareProjectToggle={this.onShareProjectToggle}
            onDeleteProjectToggle={this.onDeleteProjectToggle}
            onLeaveGroupToggle={this.onLeaveGroupToggle}
            onFreezedItem={this.onFreezedItem}
            onUnfreezedItem={this.onUnfreezedItem}
            onCopyProjectToggle={this.onCopyProjectToggle}
            onAddProject={this.props.onAddProject}
            onUpdateProject={this.onUpdateProject}
            onMobileShareProjectToggle={this.onMobileShareProjectToggle}
            onMobileUpdateProjectToggle={this.onMobileUpdateProjectToggle}
            onLeaveGroupSharedProject={this.onLeaveGroupSharedProject}
            renderAddItem={this.renderAddItem}
            openGroupMember={this.openGroupMember}
            onRenameGroupToggle={this.onRenameGroupToggle}
            toggleManageMembersDialog={this.toggleManageMembersDialog}
            onDtableManageMembers={this.onDtableManageMembers}
            onDeleteGroupToggle={this.onDeleteGroupToggle}
            onTransferGroupToggle={this.onTransferGroupToggle}
            toggleGroupInviteDialog={this.toggleGroupInviteDialog}
            hideVirtualProject={this.hideVirtualProject}
            setDropdownState={this.setDropdownState}
            getDropdownState={this.getDropdownState}
            onCopyProject={this.props.onCopyProject}
          />
        </div>
        {this.renderEmpty()}
        {this.state.isShowDeleteDialog && (
          <CommonOperationConfirmationDialog
            title={gettext('Delete base')}
            message={gettext('Are you sure you want to delete the base {placeholder} ?').replace('{placeholder}', `<b>${this.state.currentProject.name}</b>`)}
            executeOperation={this.onDeleteProject}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.onDeleteProjectToggle}
          />
        )}
        {this.state.isShowRenameTableDialog &&
          <RenameGroupNameDialog
            onRenameGroupToggle={this.onRenameGroupToggle}
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
        {this.state.isShowMobileShareProject &&
          <ModalPortal>
            <MobileShareTable
              hideMobileShareProject={this.hideMobileShareProject}
              currentProject={this.state.currentProject}
            />
          </ModalPortal>
        }
        {this.state.isShowMobileRenameView &&
          <ModalPortal>
            <RenameBaseView
              onMobileUpdateItemToggle={this.onMobileUpdateProjectToggle}
              currentItem={this.state.currentProject}
              onUpdateItem={this.onUpdateProject}
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
