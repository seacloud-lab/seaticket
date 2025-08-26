import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Project from './project';
import SharedProject from './shared-project';
import VirtualProject from './virtual-project';
import { gettext } from '../../../constants';

import './index.css';

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
  onLeaveGroupSharedProject: PropTypes.func,
  onFreezedItem: PropTypes.func,
  onUnfreezedItem: PropTypes.func,
  hideVirtualProject: PropTypes.func,
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
    const { isDesktop, isOwner, isAdmin, isItemFreezed, getProjectClassAndStyle, projectList, groupSharedProjects } = this.props;
    const total = projectList.length + groupSharedProjects.length;
    const { className: virtualClassName, style: virtualStyle } = getProjectClassAndStyle(total, total);
    return (
      <div className={classnames('project-group-content d-flex', {
        'project-item-container': isDesktop,
        'table-mobile-item-container': !isDesktop,
      })}
      >
        {total === 0 && (
          <div className="tip">{gettext('No project')}</div>
        )}
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
        {groupSharedProjects.map((project, index) => {
          const { className, style } = getProjectClassAndStyle(projectList.length + index, total);
          return (
            <SharedProject
              className={className}
              style={style}
              key={index}
              sharedItemKey={`table-${index}`}
              project={project}
              isItemFreezed={isItemFreezed}
              isAdmin={isAdmin}
              workspace={this.props.workspace}
              onLeaveShare={this.props.onLeaveGroupSharedProject}
              setDropdownState={this.props.setDropdownState}
              getDropdownState={this.props.getDropdownState}
              onCopyProjectToggle={this.props.onCopyProjectToggle}
              onCopyProject={this.props.onCopyProject}
              currentWorkspace={this.props.workspace}
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

WorkspaceContainer.propTypes = propTypes;

export default WorkspaceContainer;
