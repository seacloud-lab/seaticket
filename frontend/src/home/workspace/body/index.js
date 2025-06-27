import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Project from './project';
import SharedProject from './shared-project';
import VirtualProject from './virtual-project';

const propTypes = {
  workspace: PropTypes.object,
  isDesktop: PropTypes.bool,
  isOwnerOrAdmin: PropTypes.bool,
  isOwner: PropTypes.bool,
  openGroupMember: PropTypes.func,
  onRenameGroupToggle: PropTypes.func,
  toggleManageMembersDialog: PropTypes.func,
  onDtableManageMembers: PropTypes.func,
  onDeleteGroupToggle: PropTypes.func,
  onTransferGroupToggle: PropTypes.func,
  toggleGroupInviteDialog: PropTypes.func,
  projectList: PropTypes.array,
  groupSharedProjects: PropTypes.array,
  connectDropTarget: PropTypes.func,
  canDrop: PropTypes.bool,
  isAdmin: PropTypes.bool,
  isShowVirtualProject: PropTypes.bool,
  isItemFreezed: PropTypes.bool,
  isPersonal: PropTypes.bool,
  canAddProject: PropTypes.bool,
  onLeaveGroupSharedProject: PropTypes.func,
  onFreezedItem: PropTypes.func,
  onUnfreezedItem: PropTypes.func,
  renderAddItem: PropTypes.func,
  hideVirtualDtable: PropTypes.func,
  onShareProjectToggle: PropTypes.func,
  onSetPasswordToggle: PropTypes.func,
  onUnsetPasswordToggle: PropTypes.func,
  onModifyPasswordToggle: PropTypes.func,
  onDeleteProjectToggle: PropTypes.func,
  onCopyProjectToggle: PropTypes.func,
  onAddProject: PropTypes.func,
  onUpdateProject: PropTypes.func,
  onMobileShareProjectToggle: PropTypes.func,
  onMobileUpdateProjectToggle: PropTypes.func,
  createBlankProject: PropTypes.func,
  setDropdownState: PropTypes.func,
  getDropdownState: PropTypes.func,
  onCopyProject: PropTypes.func,
};

class WorkspaceContainer extends Component {

  render() {
    const { isDesktop, isOwner, isAdmin, isItemFreezed } = this.props;

    return (
      <div className={classnames('', {
        'project-item-container': isDesktop,
        'table-mobile-item-container': !isDesktop,
      })}
      >
        {this.props.projectList.map((project, index) => {
          return (
            <Project
              key={index}
              project={project}
              isItemFreezed={isItemFreezed}
              isOwner={isOwner}
              isAdmin={isAdmin}
              onShareProjectToggle={this.props.onShareProjectToggle}
              onSetPasswordToggle={this.props.onSetPasswordToggle}
              onUnsetPasswordToggle={this.props.onUnsetPasswordToggle}
              onModifyPasswordToggle={this.props.onModifyPasswordToggle}
              onDeleteProjectToggle={this.props.onDeleteProjectToggle}
              onCopyProjectToggle={this.props.onCopyProjectToggle}
              onAddProject={this.props.onAddProject}
              onUpdateProject={this.props.onUpdateProject}
              onMobileShareProjectToggle={this.props.onMobileShareProjectToggle}
              onMobileUpdateProjectToggle={this.props.onMobileUpdateProjectToggle}
              onFreezedItem={this.props.onFreezedItem}
              onUnfreezedItem={this.props.onUnfreezedItem}
              setDropdownState={this.props.setDropdownState}
              getDropdownState={this.props.getDropdownState}
            />
          );
        })}
        {this.props.isShowVirtualProject && (
          <VirtualProject
            currentWorkspace={this.props.workspace}
            createBlankProject={this.props.createBlankProject}
            hideVirtualDtable={this.props.hideVirtualDtable}
          />
        )}
        {this.props.groupSharedProjects.map((project, index) => {
          return (
            <SharedProject
              key={index}
              sharedItemKey={`table-${index}`}
              project={project}
              isItemFreezed={isItemFreezed}
              isAdmin={isAdmin}
              onLeaveShare={this.props.onLeaveGroupSharedProject}
              setDropdownState={this.props.setDropdownState}
              getDropdownState={this.props.getDropdownState}
              onCopyProjectToggle={this.props.onCopyProjectToggle}
              onCopyProject={this.props.onCopyProject}
              currentWorkspace={this.props.workspace}
            />
          );
        })}
        {this.props.canAddProject && (this.props.isPersonal || isOwner || isAdmin) &&
          this.props.renderAddItem()
        }
      </div>
    );
  }
}

WorkspaceContainer.propTypes = propTypes;

export default WorkspaceContainer;
