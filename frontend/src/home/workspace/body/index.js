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
  onRenameDtableGroupToggle: PropTypes.func,
  toggleManageMembersDialog: PropTypes.func,
  onDtableManageMembers: PropTypes.func,
  onDeleteGroupToggle: PropTypes.func,
  onTransferGroupToggle: PropTypes.func,
  toggleGroupInviteDialog: PropTypes.func,
  projectList: PropTypes.array,
  groupSharedTables: PropTypes.array,
  connectDropTarget: PropTypes.func,
  canDrop: PropTypes.bool,
  isAdmin: PropTypes.bool,
  isShowVirtualDtable: PropTypes.bool,
  isItemFreezed: PropTypes.bool,
  isPersonal: PropTypes.bool,
  canAddProject: PropTypes.bool,
  onLeaveGroupSharedTable: PropTypes.func,
  onFreezedItem: PropTypes.func,
  onUnfreezedItem: PropTypes.func,
  onLeaveGroupSharedView: PropTypes.func,
  renderAddTableItem: PropTypes.func,
  hideVirtualDtable: PropTypes.func,
  renameTable: PropTypes.func,
  onShareTableToggle: PropTypes.func,
  onSetPasswordToggle: PropTypes.func,
  onUnsetPasswordToggle: PropTypes.func,
  onModifyPasswordToggle: PropTypes.func,
  onDeleteTableToggle: PropTypes.func,
  onCopyDTableToggle: PropTypes.func,
  onAddDTable: PropTypes.func,
  onMobileShareTableToggle: PropTypes.func,
  onMobileUpdateTableToggle: PropTypes.func,
  createBlankTable: PropTypes.func,
  setDropdownState: PropTypes.func,
  getDropdownState: PropTypes.func,
  onCopyDTable: PropTypes.func,
};

class WorkspaceContainer extends Component {

  render() {
    const { isDesktop, isOwner, isAdmin, isItemFreezed } = this.props;

    return (
      <div className={classnames('', {
        'table-item-container': isDesktop,
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
              renameTable={this.props.renameTable}
              onShareTableToggle={this.props.onShareTableToggle}
              onSetPasswordToggle={this.props.onSetPasswordToggle}
              onUnsetPasswordToggle={this.props.onUnsetPasswordToggle}
              onModifyPasswordToggle={this.props.onModifyPasswordToggle}
              onDeleteTableToggle={this.props.onDeleteTableToggle}
              onCopyDTableToggle={this.props.onCopyDTableToggle}
              onAddDTable={this.props.onAddDTable}
              onMobileShareTableToggle={this.props.onMobileShareTableToggle}
              onMobileUpdateTableToggle={this.props.onMobileUpdateTableToggle}
              onFreezedItem={this.props.onFreezedItem}
              onUnfreezedItem={this.props.onUnfreezedItem}
              setDropdownState={this.props.setDropdownState}
              getDropdownState={this.props.getDropdownState}
            />
          );
        })}
        {this.props.isShowVirtualDtable && (
          <VirtualProject
            currentWorkspace={this.props.workspace}
            createBlankTable={this.props.createBlankTable}
            hideVirtualDtable={this.props.hideVirtualDtable}
          />
        )}
        {this.props.groupSharedTables.map((project, index) => {
          return (
            <SharedProject
              key={index}
              sharedItemKey={`table-${index}`}
              project={project}
              isItemFreezed={isItemFreezed}
              isAdmin={isAdmin}
              onLeaveShare={this.props.onLeaveGroupSharedTable}
              setDropdownState={this.props.setDropdownState}
              getDropdownState={this.props.getDropdownState}
              onCopyDTableToggle={this.props.onCopyDTableToggle}
              onCopyDTable={this.props.onCopyDTable}
              currentWorkspace={this.props.workspace}
            />
          );
        })}
        {this.props.canAddProject && (this.props.isPersonal || isOwner || isAdmin) &&
          this.props.renderAddTableItem()
        }
      </div>
    );
  }
}

WorkspaceContainer.propTypes = propTypes;

export default WorkspaceContainer;
