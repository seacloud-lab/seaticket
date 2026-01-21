import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Project from './project';
import VirtualProject from './virtual-project';

import './workspace-container.css';

class WorkspaceContainer extends Component {

  render() {
    const { isDesktop, isOwner, isAdmin, isItemFreezed, getProjectClassAndStyle, projectList } = this.props;
    const total = projectList.length;
    const { className: virtualClassName, style: virtualStyle } = getProjectClassAndStyle(total, total);
    return (
      <div className={classnames('project-group-content d-flex', {
        'project-item-container': isDesktop,
        'table-mobile-item-container': !isDesktop,
      })}
      >
        {projectList.map((project, index) => {
          const { className, style } = getProjectClassAndStyle(index, total);
          return (
            <Project
              className={className}
              style={style}
              key={index}
              project={project}
              isItemFreezed={isItemFreezed}
              isOwner={isOwner}
              isAdmin={isAdmin}
              workspace={this.props.workspace}
              onAPITokenToggle={this.props.onAPITokenToggle}
              onSetPasswordToggle={this.props.onSetPasswordToggle}
              onUnsetPasswordToggle={this.props.onUnsetPasswordToggle}
              onModifyPasswordToggle={this.props.onModifyPasswordToggle}
              onDeleteProjectToggle={this.props.onDeleteProjectToggle}
              onCopyProjectToggle={this.props.onCopyProjectToggle}
              onUpdateProject={this.props.onUpdateProject}
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
            className={virtualClassName}
            style={virtualStyle}
            currentWorkspace={this.props.workspace}
            createBlankProject={this.props.createBlankProject}
            hideVirtualProject={this.props.hideVirtualProject}
            getProjectClassAndStyle={this.props.getProjectClassAndStyle}
          />
        )}
      </div>
    );
  }
}

WorkspaceContainer.propTypes = {
  workspace: PropTypes.object,
  isDesktop: PropTypes.bool,
  isOwnerOrAdmin: PropTypes.bool,
  isOwner: PropTypes.bool,
  openGroupMember: PropTypes.func,
  onRenameGroupToggle: PropTypes.func,
  toggleManageMembersDialog: PropTypes.func,
  onProjectManageMembers: PropTypes.func,
  onDeleteGroupToggle: PropTypes.func,
  onTransferGroupToggle: PropTypes.func,
  toggleGroupInviteDialog: PropTypes.func,
  projectList: PropTypes.array,
  connectDropTarget: PropTypes.func,
  canDrop: PropTypes.bool,
  isAdmin: PropTypes.bool,
  isShowVirtualProject: PropTypes.bool,
  isItemFreezed: PropTypes.bool,
  isPersonal: PropTypes.bool,
  onFreezedItem: PropTypes.func,
  onUnfreezedItem: PropTypes.func,
  hideVirtualProject: PropTypes.func,
  onSetPasswordToggle: PropTypes.func,
  onUnsetPasswordToggle: PropTypes.func,
  onModifyPasswordToggle: PropTypes.func,
  onDeleteProjectToggle: PropTypes.func,
  onAPITokenToggle: PropTypes.func,
  onCopyProjectToggle: PropTypes.func,
  onUpdateProject: PropTypes.func,
  onMobileUpdateProjectToggle: PropTypes.func,
  createBlankProject: PropTypes.func,
  setDropdownState: PropTypes.func,
  getDropdownState: PropTypes.func,
  onCopyProject: PropTypes.func,
};

export default WorkspaceContainer;
