import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DropTarget } from 'react-dnd';
import { Button } from 'reactstrap';
import FolderTreeItem from './folder-tree-item';
import WorkspaceName from './workspace-name';
import VirtualFolder from '../../virtual-folder';

import './folder-tree.css';

const gettext = window.gettext;

const dropCollect = (connect, monitor) => ({
  connectDropTarget: connect.dropTarget(),
  isOver: monitor.isOver(),
  canDrop: monitor.canDrop(),
});

const folderDropTarget = {
  drop(props, monitor) {
    const dropFolder = props.folder;
    const optionSource = monitor.getItem();

    // mode: drag normal base
    if (optionSource.mode === 'drag-base') {
      const draggedTable = optionSource.data;
      const dragFolder = optionSource.folder;
      // when draggedTable is in root, dragFolder is null
      if (!dragFolder || dragFolder.id !== dropFolder.id) {
        props.moveTableToFolder(draggedTable, dropFolder, dragFolder);
      }
    }
    // mode: drag share to me base or view
    else if (optionSource.mode === 'view' || optionSource.mode === 'dtable') {
      props.moveTableToFolder(optionSource, dropFolder);
    }
  },
  canDrop(props, monitor) {
    return true;
  },
};

const workspaceDropTarget = {
  drop(props, monitor) {
    const optionSource = monitor.getItem();
    const draggedTable = optionSource.data;
    const dragFolder = optionSource.folder;
    const dropFolder = null;
    if (dragFolder) {
      props.moveTableToFolder(draggedTable, dropFolder, dragFolder);
    }
  },
  canDrop(props, monitor) {
    return true;
  },
};

export default class FolderTree extends Component {

  static propTypes = {
    folder: PropTypes.object,
    folders: PropTypes.array.isRequired,
    changeCurrentFolder: PropTypes.func.isRequired,
    deleteFolder: PropTypes.func.isRequired,
    moveTableToFolder: PropTypes.func.isRequired,
    workspace: PropTypes.object,
    isOwnerOrAdmin: PropTypes.bool.isRequired,
    onUpdateFolderName: PropTypes.func,
    createBlankFolder: PropTypes.func,
  };

  state = {
    isShowVirtualFolder: false,
  };

  isDropdownOpen = false;

  getDropdownState = () => {
    return this.isDropdownOpen;
  };

  setDropdownState = (state) => {
    this.isDropdownOpen = state;
  };

  showVirtualFolder = () => {
    this.setState({ isShowVirtualFolder: true });
  };

  hideVirtualFolder = () => {
    this.setState({ isShowVirtualFolder: false });
  };

  render() {
    const { folders, workspace, isOwnerOrAdmin } = this.props;
    const selectedFolder = this.props.folder || {};
    const DndFolderTreeItem = DropTarget('Base', folderDropTarget, dropCollect)(FolderTreeItem);
    const DndWorkspaceName = DropTarget('Base', workspaceDropTarget, dropCollect)(WorkspaceName);
    return (
      <div className="folder-tree" style={{ maxHeight: window.innerHeight - 140 }}>
        <DndWorkspaceName
          workspace={workspace}
          moveTableToFolder={this.props.moveTableToFolder}
          changeCurrentFolder={this.props.changeCurrentFolder}
        />
        {folders.map((folder, index) => {
          return (
            <DndFolderTreeItem
              key={folder.id}
              folder={folder}
              isOwnerOrAdmin={isOwnerOrAdmin}
              setDropdownState={this.setDropdownState}
              getDropdownState={this.getDropdownState}
              deleteFolder={this.props.deleteFolder}
              isSelected={selectedFolder.id === folder.id}
              onFolderToggle={this.props.changeCurrentFolder}
              moveTableToFolder={this.props.moveTableToFolder}
              onUpdateFolderName={this.props.onUpdateFolderName}
            />
          );
        })}
        {this.state.isShowVirtualFolder &&
          <VirtualFolder
            currentWorkspace={workspace}
            hideVirtualFolder={this.hideVirtualFolder}
            createBlankFolder={(folder) => {
              this.props.createBlankFolder(folder);
              this.hideVirtualFolder();
            }}
          />
        }
        {isOwnerOrAdmin &&
          <Button className="btn-link folder-tree-footer my-2" onClick={this.showVirtualFolder}>
            <span className='dtable-font dtable-icon-enlarge mr-2' aria-hidden="true"></span>
            <span title={gettext('New folder')} aria-label={gettext('New folder')}>{gettext('New folder')}</span>
          </Button>
        }
      </div>
    );
  }
}
