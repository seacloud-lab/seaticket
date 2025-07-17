import React, { Component } from 'react';
import PropTypes from 'prop-types';
import HeaderDropdownMenu from '../dropdown-menu/header-dropdown-menu';
import { Icon } from '../../components';

const gettext = window.gettext;

const propTypes = {
  workspace: PropTypes.object,
  isDesktop: PropTypes.bool,
  isOwnerOrAdmin: PropTypes.bool,
  isOwner: PropTypes.bool,
  openGroupMember: PropTypes.func,
  onRenameGroupToggle: PropTypes.func,
  toggleManageMembersDialog: PropTypes.func,
  onProjectManageMembers: PropTypes.func,
  onDeleteGroupToggle: PropTypes.func,
  onLeaveGroupToggle: PropTypes.func,
  onTransferGroupToggle: PropTypes.func,
  toggleGroupInviteDialog: PropTypes.func,
  toggleGroupTrashDialog: PropTypes.func,
};

class WorkspaceHeader extends Component {

  renderName = () => {
    const { workspace } = this.props;
    const { type, group_owner, name } = workspace;
    const isPersonal = type === 'personal';
    const isDepart = group_owner === 'system admin';
    if (isPersonal) {
      return (
        <>
          <Icon symbol="creator" className="project-workspace-icon" />
          <span className="text-truncate flex-1" title={gettext('My projects')}>{gettext('My projects')}</span>
        </>
      );
    }
    if (isDepart) {
      return (
        <>
          <Icon symbol="department" className="project-workspace-icon" title={gettext('This is a department')}/>
          <span className="text-truncate flex-1" title={name}>{name}</span>
        </>
      );
    }

    return (
      <>
        <Icon symbol="collaborator" className="project-workspace-icon"/>
        <span className="text-truncate flex-1" title={name}>{name}</span>
      </>
    );
  };

  render() {
    const { isDesktop, isOwnerOrAdmin, isOwner, workspace, isAdmin } = this.props;
    const isPersonal = workspace.type === 'personal';
    const isDepart = workspace.group_owner === 'system admin';
    const isDepartV2 = workspace.group_owner === 'system admin' && workspace.department_id;
    let showGroupOptions = true;
    if (isPersonal) {
      showGroupOptions = false;
    } else if (isDepart) {
      if (!isDepartV2 && !isOwnerOrAdmin) { // old department and non-admin no dropdown
        showGroupOptions = false;
      }
    }
    return (
      <div className={`${isDesktop ? '' : 'table-mobile-heading ' }workspace-header`}>
        <span className="d-flex align-items-center o-hidden flex-1">{this.renderName()}</span>
        <HeaderDropdownMenu
          onRenameGroupToggle={this.props.onRenameGroupToggle}
          onManageMembersToggle={this.props.toggleManageMembersDialog}
          onProjectManageMembers={this.props.onProjectManageMembers}
          onDeleteGroupToggle={this.props.onDeleteGroupToggle}
          onLeaveGroupToggle={this.props.onLeaveGroupToggle}
          onTransferGroupToggle={this.props.onTransferGroupToggle}
          toggleGroupInviteDialog={this.props.toggleGroupInviteDialog}
          toggleGroupTrashDialog={this.props.toggleGroupTrashDialog}
          openGroupMember={this.props.openGroupMember}
          isPersonal={isPersonal}
          isOwner={isOwner}
          isAdmin={isAdmin}
          isOwnerOrAdmin={isOwnerOrAdmin}
          isDepart={isDepart}
          workspace={workspace}
          showVirtualProject={this.props.showVirtualProject}
          showGroupOptions={showGroupOptions}
        />
      </div>
    );
  }
}

WorkspaceHeader.propTypes = propTypes;

export default WorkspaceHeader;
