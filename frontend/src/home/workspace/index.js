import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster, Loading, CommonOperationConfirmationDialog } from '@/components';
import homeAPI from '../api';
import ManageMembersDialog from '../dialog/manage-members-dialog';
import RenameGroupNameDialog from '../dialog/rename-group-name-dialog';
import GroupInviteMembersDialog from '../dialog/group-invite-members-dialog';
import { Utils } from '@/utils/utils';
import { compareTwoString } from '../utils/compare-two-string';
import WorkspaceMemberDialog from '../dialog/workspace-member-dialog';
import TransferGroupDialog from '../dialog/transfer-group-dialog';
import ModalPortal from '@/components/modal-portal';
import RenameProjectView from '../mobile/rename-project-view';
import Header from './header';
import Body from './body';
import LeaveGroupDialog from '../dialog/leave-group-dialog';
import GroupTrashDialog from '../dialog/group-trash-dialog';
import ProjectAPITokenDialog from '../../components/dialog/project-api-token-dialog';

const gettext = window.gettext;
const username = window.app.pageOptions.username;

const propTypes = {
  workspace: PropTypes.object.isRequired,
  renameGroupName: PropTypes.func,
  onDeleteGroup: PropTypes.func,
  onCopyProject: PropTypes.func.isRequired,
  onDeleteProject: PropTypes.func.isRequired,
  onAddProject: PropTypes.func,
  loadWorkspaceList: PropTypes.func,
  emptyTip: PropTypes.object
};

class Workspace extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      projectList: [],
      isDataLoading: true,
      isItemFreezed: false,
      isShowDeleteDialog: false,
      isShowRenameTableDialog: false,
      isShowManageMembersDialog: false,
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
      isShowMobileRenameView: false,
      isShowMovingDialog: false,
      isShowAPITokenDialog: false,
      isParsing: false,
      projectItemWidth: 168,
      numberOfItemsPerRow: 1,
    };
    this.isDropdownOpen = false;
    this.isDesktop = Utils.isDesktop();
  }

  componentDidMount() {
    window.addEventListener('resize', this.onResize);
    const { workspace } = this.props;
    const { projectList } = this.getSortedWorkspaceContent(workspace);
    this.setState({ projectList, isDataLoading: false }, () => {
      this.onResize();
    });
    this.setWorkspaceAdminState(workspace);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
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

  onResize = () => {
    // 16: project item margin with or view content padding width
    // 184: project Item min-width[168] and margin right[16]
    // 352: two project Item min-width sum[336] + padding[32] + margin right[16]
    // 536: three project Item min-width sum[504] + padding[32] + two margin right[32]
    if (!this.curViewContent) return;
    const { clientWidth, offsetWidth } = this.curViewContent;
    if (!this.isDesktop) {
      const contentWidth = clientWidth - 16 * 2;
      let numberOfItemsPerRow = 1;
      let projectItemWidth = contentWidth;
      if (contentWidth >= 536) {
        numberOfItemsPerRow = 3;
        // The first and second project items margin-right sum is 32
        projectItemWidth = (contentWidth - 32) / 3;
      } else if (contentWidth >= 352) {
        numberOfItemsPerRow = 2;
        // The first project item margin-right is 16
        projectItemWidth = (contentWidth - 16) / 2;
      }
      this.setState({ projectItemWidth, numberOfItemsPerRow });
    } else {
      const scrollBarWidth = offsetWidth - clientWidth;
      const projectListWidth = parseInt(window.innerWidth * (1 - 0.22) - 16 * 2 + 16 - scrollBarWidth);
      const numberOfItemsPerRow = Math.floor(projectListWidth / 184);
      const remainingWidth = projectListWidth % 184;
      let projectItemWidth;
      if (remainingWidth > 0) {
        projectItemWidth = 168 + remainingWidth / numberOfItemsPerRow;
      } else {
        projectItemWidth = 168;
      }
      this.setState({ projectItemWidth, numberOfItemsPerRow });
    }
  };

  getProjectClassAndStyle = (index, totalCount) => {
    const { projectItemWidth, numberOfItemsPerRow } = this.state;

    // 0.22: percentage of side panel; 16: cur-view-content's padding left/right;
    // 168: project item width; 20: project item margin right/bottom
    let allLineProjectCount = parseInt(totalCount / numberOfItemsPerRow) * numberOfItemsPerRow;
    if (allLineProjectCount === totalCount) {
      allLineProjectCount = allLineProjectCount - numberOfItemsPerRow;
    }
    let className = '';
    let style = { width: projectItemWidth };

    if (this.isDesktop) {
      const validIndex = index + 1;
      if (validIndex % numberOfItemsPerRow === 0) {
        className += 'mr-0 ';
      }
      if (validIndex > allLineProjectCount) {
        className += 'mb-0 ';
      }
      return { className, style };
    }
    if (index > numberOfItemsPerRow - 1) {
      style.marginLeft = index % numberOfItemsPerRow === 0 ? - ((projectItemWidth + 16) * numberOfItemsPerRow) : 0;
      style.marginTop = parseInt(index / numberOfItemsPerRow) * 192;
      return { className, style };
    }
    return { className, style };
  };

  getSortedWorkspaceContent = (workspace) => {
    let { projects = [] } = workspace || {};
    return {
      projectList: projects.sort((a, b) => compareTwoString(a.name, b.name)),
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

  onAPITokenToggle = (project) => {
    this.setState({
      isShowAPITokenDialog: !this.state.isShowAPITokenDialog,
      currentProject: project
    });
    this.onUnfreezedItem();
  };

  onDeleteProject = () => {
    const name = this.state.currentProject.name;
    this.deleteProject(name);
    this.onDeleteProjectToggle();
  };

  onMobileUpdateProjectToggle = (project) => {
    this.setState({
      isShowMobileRenameView: !this.state.isShowMobileRenameView,
      currentProject: project
    });
  };

  onCreateProject = (name, owner, icon, bgColor) => {
    homeAPI.createProject(name, owner, icon, bgColor).then((res) => {
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
    homeAPI.deleteProject(workspaceID, projectName).then(() => {
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
    homeAPI.updateProject(this.props.workspace.id, projectName, updated).then((res) => {
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

  onProjectManageMembers = () => {
    homeAPI.getGroup(this.props.workspace.group_id).catch(error => {
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
      toaster.danger(gettext('Cannot delete group with projects'));
      return;
    }
    homeAPI.deleteGroup(groupID).then(() => {
      toaster.success(gettext('Group deleted'));
      this.props.onDeleteGroup(groupID);
    }).catch((error) => {
      this.handleError(error);
    });
  };

  onLeaveGroup = () => {
    let groupID = this.props.workspace.group_id;
    homeAPI.deleteGroupMember(groupID, username).then((res) => {
      toaster.success(gettext('You have left the group'));
      this.props.onDeleteGroup(groupID);
    }).catch(error => {
      this.handleError(error);
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
      return this.props.emptyTip || '';
    }
  };

  render() {
    const { workspace } = this.props;
    const isPersonal = workspace.type === 'personal';
    let { projectList, isItemFreezed, isDataLoading, isOwner, isAdmin } = this.state;
    if (isDataLoading) {
      return <Loading />;
    }

    const isOwnerOrAdmin = !isPersonal && (isOwner || isAdmin);

    return (
      <Fragment>
        <div className="workspace project-group-container" ref={ref => this.curViewContent = ref}>
          <Header
            workspace={workspace}
            isDesktop={this.isDesktop}
            isOwnerOrAdmin={isOwnerOrAdmin}
            isPersonal={isPersonal}
            isOwner={isOwner}
            isAdmin={isAdmin}
            openGroupMember={this.openGroupMember}
            onRenameGroupToggle={this.onRenameGroupToggle}
            toggleManageMembersDialog={this.toggleManageMembersDialog}
            onProjectManageMembers={this.onProjectManageMembers}
            onDeleteGroupToggle={this.onDeleteGroupToggle}
            onLeaveGroupToggle={this.onLeaveGroupToggle}
            onTransferGroupToggle={this.onTransferGroupToggle}
            toggleGroupInviteDialog={this.toggleGroupInviteDialog}
            toggleGroupTrashDialog={this.toggleGroupTrashDialog}
            showVirtualProject={this.showVirtualProject}
          />
          <Body
            isDesktop={this.isDesktop}
            isOwnerOrAdmin={isOwnerOrAdmin}
            isPersonal={isPersonal}
            isOwner={isOwner}
            isAdmin={isAdmin}
            workspace={workspace}
            projectList={projectList}
            isItemFreezed={isItemFreezed}
            isShowVirtualProject={this.state.isShowVirtualProject}
            createBlankProject={this.createBlankProject}
            onShowTemplateListToggle={this.onShowTemplateListToggle}
            onDeleteProjectToggle={this.onDeleteProjectToggle}
            onAPITokenToggle={this.onAPITokenToggle}
            onLeaveGroupToggle={this.onLeaveGroupToggle}
            onFreezedItem={this.onFreezedItem}
            onUnfreezedItem={this.onUnfreezedItem}
            onCopyProjectToggle={this.onCopyProjectToggle}
            onAddProject={this.props.onAddProject}
            onUpdateProject={this.onUpdateProject}
            onMobileUpdateProjectToggle={this.onMobileUpdateProjectToggle}
            openGroupMember={this.openGroupMember}
            onRenameGroupToggle={this.onRenameGroupToggle}
            toggleManageMembersDialog={this.toggleManageMembersDialog}
            onProjectManageMembers={this.onProjectManageMembers}
            onDeleteGroupToggle={this.onDeleteGroupToggle}
            onTransferGroupToggle={this.onTransferGroupToggle}
            toggleGroupInviteDialog={this.toggleGroupInviteDialog}
            hideVirtualProject={this.hideVirtualProject}
            setDropdownState={this.setDropdownState}
            getDropdownState={this.getDropdownState}
            onCopyProject={this.props.onCopyProject}
            getProjectClassAndStyle={this.getProjectClassAndStyle}
          />
        </div>
        {this.renderEmpty()}
        {this.state.isShowDeleteDialog && (
          <CommonOperationConfirmationDialog
            title={gettext('Delete project')}
            message={gettext('Are you sure you want to delete the project {placeholder} ?').replace('{placeholder}', `<b>${this.state.currentProject.name}</b>`)}
            executeOperation={this.onDeleteProject}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.onDeleteProjectToggle}
          />
        )}
        {this.state.isShowAPITokenDialog && this.state.currentProject && (
          <ProjectAPITokenDialog
            projectUuid={this.state.currentProject.uuid}
            projectName={this.state.currentProject.name}
            toggle={this.onAPITokenToggle}
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
        {this.state.isShowGroupMember && (
          <WorkspaceMemberDialog
            workspace={workspace}
            onGroupMemberToggle={this.onGroupMemberToggle}
          />
        )}
        {this.state.isShowMobileRenameView &&
          <ModalPortal>
            <RenameProjectView
              onMobileUpdateItemToggle={this.onMobileUpdateProjectToggle}
              currentItem={this.state.currentProject}
              onUpdateItem={this.onUpdateProject}
            />
          </ModalPortal>
        }
        {this.state.isShowInviteDialog && (
          <GroupInviteMembersDialog
            workspace={workspace}
            toggleGroupInviteDialog={this.toggleGroupInviteDialog}
          />
        )}
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
