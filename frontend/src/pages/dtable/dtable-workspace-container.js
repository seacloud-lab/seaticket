import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { DropTarget } from 'react-dnd';
import DTableItemCommon from './dtable-item-common';
import DTableItemGroupShared from './dtable-item-group-shared';
import VirtualDtable from './virtual-dtable';
import DTableFolder from './dtable-folder';
import VirtualFolder from './virtual-folder';

// table cannot be dropped
const dropTarget = {
  drop(props, monitor) {
  },
  canDrop(props, monitor) {
    return false;
  },
};

// Folder can be dropped(move root table into folder)
const folderDropTarget = {
  drop(props, monitor) {
    const optionSource = monitor.getItem();
    const draggedTable = optionSource.data;
    const dropFolder = props.folder;
    const dragFolder = optionSource.folder;
    if (!dragFolder) {
      props.moveTableToFolder(draggedTable, dropFolder);
    }
  },
  // 1、drag table from root to folder, can drop
  // 2、drag folder table to another folder, can not drop
  canDrop(props, monitor) {
    const optionSource = monitor.getItem();
    return !optionSource.folder;
  },
};

const dropCollect = (connect, monitor) => ({
  connectDropTarget: connect.dropTarget(),
  isOver: monitor.isOver(),
  canDrop: monitor.canDrop(),
});

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
  folders: PropTypes.array,
  projectList: PropTypes.array,
  groupSharedTables: PropTypes.array,
  connectDropTarget: PropTypes.func,
  canDrop: PropTypes.bool,
  isAdmin: PropTypes.bool,
  isShowVirtualDtable: PropTypes.bool,
  isItemFreezed: PropTypes.bool,
  isPersonal: PropTypes.bool,
  canAddProject: PropTypes.bool,
  onFolderToggle: PropTypes.func,
  deleteFolder: PropTypes.func,
  onUpdateFolderName: PropTypes.func,
  moveFolderItem: PropTypes.func,
  moveTableToFolder: PropTypes.func,
  onLeaveGroupSharedTable: PropTypes.func,
  onFreezedItem: PropTypes.func,
  onUnfreezedItem: PropTypes.func,
  onMoveFolderItemToggle: PropTypes.func,
  onLeaveGroupSharedView: PropTypes.func,
  renderAddTableItem: PropTypes.func,
  hideVirtualDtable: PropTypes.func,
  isShowVirtualFolder: PropTypes.bool,
  createBlankFolder: PropTypes.func,
  hideVirtualFolder: PropTypes.func,
  renameTable: PropTypes.func,
  onShareTableToggle: PropTypes.func,
  onSetPasswordToggle: PropTypes.func,
  onUnsetPasswordToggle: PropTypes.func,
  onModifyPasswordToggle: PropTypes.func,
  onDeleteTableToggle: PropTypes.func,
  onTableAPITokenToggle: PropTypes.func,
  onWebhookToggle: PropTypes.func,
  onTableSnapshotsToggle: PropTypes.func,
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

  isBaseInFolder(folders, base) {
    for (let i = 0; i < folders.length; i++) {
      if (folders[i].items.find(item => item.item_id === base.uuid)) {
        return true;
      }
    }
    return false;
  }

  isShareTableInFolder(folders, table) {
    for (let i = 0; i < folders.length; i++) {
      if (folders[i].items.find(item => item.item_id === table.dtable_share_id.toString())) {
        return true;
      }
    }
    return false;
  }

  render() {
    const { folders, canDrop, isDesktop, connectDropTarget, isOwner, isAdmin, isItemFreezed } = this.props;
    const DndDTableItemCommon = DropTarget('Base', dropTarget, dropCollect)(DTableItemCommon);
    const DndDTableItemGroupShared = DropTarget('Base', dropTarget, dropCollect)(DTableItemGroupShared);
    const DndDTableFolder = DropTarget('Base', folderDropTarget, dropCollect)(DTableFolder);

    return (connectDropTarget(
      <div className={classnames('', {
        'table-item-container': isDesktop,
        'table-mobile-item-container': !isDesktop,
        'tr-highlight': canDrop
      })}
      >
        {folders.map((folder, index) => {
          return (
            <DndDTableFolder
              key={index}
              folder={folder}
              isOwnerOrAdmin={isOwner || isAdmin}
              onFolderToggle={this.props.onFolderToggle}
              deleteFolder={this.props.deleteFolder}
              onUpdateFolderName={this.props.onUpdateFolderName}
              moveFolderItem={this.props.moveFolderItem}
              moveTableToFolder={this.props.moveTableToFolder}
              setDropdownState={this.props.setDropdownState}
              getDropdownState={this.props.getDropdownState}
            />
          );
        })}
        {this.props.projectList.map((project, index) => {
          if (this.isBaseInFolder(folders, project)) {
            return null;
          }
          return (
            <DndDTableItemCommon
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
              onTableAPITokenToggle={this.props.onTableAPITokenToggle}
              onWebhookToggle={this.props.onWebhookToggle}
              onTableSnapshotsToggle={this.props.onTableSnapshotsToggle}
              onCopyDTableToggle={this.props.onCopyDTableToggle}
              onAddDTable={this.props.onAddDTable}
              onMobileShareTableToggle={this.props.onMobileShareTableToggle}
              onMobileUpdateTableToggle={this.props.onMobileUpdateTableToggle}
              onFreezedItem={this.props.onFreezedItem}
              onUnfreezedItem={this.props.onUnfreezedItem}
              onMoveFolderItemToggle={this.props.onMoveFolderItemToggle}
              moveFolderItem={this.props.moveFolderItem}
              moveTableToFolder={this.props.moveTableToFolder}
              setDropdownState={this.props.setDropdownState}
              getDropdownState={this.props.getDropdownState}
            />
          );
        })}
        {this.props.isShowVirtualDtable && (
          <VirtualDtable
            currentWorkspace={this.props.workspace}
            createBlankTable={this.props.createBlankTable}
            hideVirtualDtable={this.props.hideVirtualDtable}
          />
        )}
        {this.props.groupSharedTables.map((project, index) => {
          if (this.isShareTableInFolder(folders, project)) {
            return null;
          }
          return (
            <DndDTableItemGroupShared
              key={index}
              sharedItemKey={`table-${index}`}
              project={project}
              isItemFreezed={isItemFreezed}
              isAdmin={isAdmin}
              onLeaveShare={this.props.onLeaveGroupSharedTable}
              setDropdownState={this.props.setDropdownState}
              getDropdownState={this.props.getDropdownState}
              onMoveFolderItemToggle={this.props.onMoveFolderItemToggle}
              onCopyDTableToggle={this.props.onCopyDTableToggle}
              onCopyDTable={this.props.onCopyDTable}
              currentWorkspace={this.props.workspace}
            />
          );
        })}
        {this.props.isShowVirtualFolder && (
          <VirtualFolder
            currentWorkspace={this.props.workspace}
            createBlankFolder={this.props.createBlankFolder}
            hideVirtualFolder={this.props.hideVirtualFolder}
          />
        )}
        {this.props.canAddProject && (this.props.isPersonal || isOwner || isAdmin) &&
          this.props.renderAddTableItem()
        }
      </div>
    ));
  }
}

WorkspaceContainer.propTypes = propTypes;

export default WorkspaceContainer;
