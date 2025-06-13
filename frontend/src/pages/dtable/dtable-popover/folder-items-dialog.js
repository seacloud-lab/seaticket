import React from 'react';
import { DropTarget } from 'react-dnd';
import { Modal, ModalBody } from 'reactstrap';
import { DTableModalHeader } from 'dtable-ui-component';
import DTableItemCommon from '../dtable-item-common';
import DTableItemGroupShared from '../dtable-item-group-shared';
import DTableFolder from '../dtable-folder';
import VirtualDtable from '../virtual-dtable';
import AddDropdownBtn from '../dtable-dropdown-menu/add-dropdown-btn';
import { folderImageSrc } from '../../../constants/image-source-constants';
import eventBus from '../../../utils/event-bus';
import { FolderItemsPropTypes } from './folder-items-constants';
import FolderItemsDialogFilePath from './folder-items-dialog-widgets/folder-items-dialog-file-path';
import FolderTree from './folder-items-dialog-widgets/folder-tree';

import './folder-items-dialog.css';

const dropTarget = {
  drop(props, monitor) {
  },
};

const dropCollect = (connect, monitor) => ({
  connectDropTarget: connect.dropTarget(),
  isOver: monitor.isOver(),
  canDrop: monitor.canDrop(),
});

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
  canDrop(props, monitor) {
    const optionSource = monitor.getItem();
    return !optionSource.folder;
  },
};

class FolderItems extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      projectList: [],
      shareProjectList: [],
      isItemFreezed: false,
      isShowVirtualDtable: false,
    };
    this.eventBus = eventBus;
  }

  componentDidMount() {
    this.initValue(this.props);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    setTimeout(() => {
      this.initValue(nextProps);
    }, 1);
  }

  initValue = (props) => {
    let { folder, folders, projectList, groupSharedTables } = props;
    let newProjectList = [];
    let newShareProjectList = [];
    // in folder
    if (folder) {
      if (folder.items) {
        const folderMap = this.getFolderItemsMap(folder.items);
        projectList.forEach((project) => {
          if (folderMap.get(project.uuid)) {
            newProjectList.push(project);
          }
        });
        groupSharedTables.forEach((shareProject) => {
          if (folderMap.get(shareProject.dtable_share_id.toString())) {
            newShareProjectList.push(shareProject);
          }
        });
      }
    }
    // in root
    else {
      let baseInFolderMap = {};
      for (let i = 0; i < folders.length; i++) {
        folders[i].items.forEach(item => {
          baseInFolderMap[item.item_id] = true;
        });
      }
      newProjectList = projectList.filter(item => {
        return !baseInFolderMap[item.uuid];
      });
      newShareProjectList = groupSharedTables.filter(item => {
        return !baseInFolderMap[item.dtable_share_id.toString()];
      });
    }
    this.setState({
      projectList: newProjectList,
      shareProjectList: newShareProjectList,
    });
  };

  getFolderItemsMap = (folderItems) => {
    let folderMap = new Map();
    folderItems.forEach(item => {
      folderMap.set(item.item_id.toString(), true);
    });
    return folderMap;
  };

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  hideVirtualDtable = () => {
    this.setState({ isShowVirtualDtable: false });
  };

  showVirtualDtable = () => {
    this.setState({ isShowVirtualDtable: true });
  };

  createBlankTable = (table) => {
    this.props.createBlankTable(table, this.props.folder);
    this.setState({ isShowVirtualDtable: false });
  };

  onFolderToggle = () => {
    this.eventBus.dispatch('folder-close');
    this.props.onFolderToggle(null);
  };

  createProjectInFolder = (tableName, owner, dtableIcon, dtableColor) => {
    this.props.createProjectInFolder(tableName, owner, dtableIcon, dtableColor, this.props.folder);
  };

  render() {
    const { folder, folders, isOwner, isAdmin, workspace, canAddProject } = this.props;
    const { type, name } = workspace;
    let { projectList, shareProjectList, isItemFreezed, isShowVirtualDtable } = this.state;
    const DndDTableItemCommon = DropTarget('Base', dropTarget, dropCollect)(DTableItemCommon);
    const DndDTableItemGroupShared = DropTarget('Base', dropTarget, dropCollect)(DTableItemGroupShared);
    const DndDTableFolder = DropTarget('Base', folderDropTarget, dropCollect)(DTableFolder);
    const isOwnerOrAdmin = isOwner || isAdmin;
    return (
      <Modal isOpen={true} toggle={this.onFolderToggle} className="folder-items-dialog">
        <DTableModalHeader toggle={this.onFolderToggle}>
          <div className="modal-title-left">
            <img src={folderImageSrc} height="24px" alt="" />
            <span className="ml-2">{folder ? folder.name : (type === 'personal' ? window.gettext('My projects') : name)}</span>
          </div>
          <div className="modal-title-right">
            {canAddProject && isOwnerOrAdmin &&
              <AddDropdownBtn
                onCreateTableToggle={this.showVirtualDtable}
                currentWorkspace={workspace}
                folder={folder}
              />
            }
          </div>
        </DTableModalHeader>
        <ModalBody>
          <FolderTree
            changeCurrentFolder={this.props.changeCurrentFolder}
            workspace={workspace}
            folder={folder}
            folders={folders}
            isOwnerOrAdmin={isOwnerOrAdmin}
            deleteFolder={this.props.deleteFolder}
            moveTableToFolder={this.props.moveTableToFolder}
            onUpdateFolderName={this.props.onUpdateFolderName}
            createBlankFolder={this.props.createBlankFolder}
          />
          <div className='folder'>
            <FolderItemsDialogFilePath
              changeCurrentFolder={this.props.changeCurrentFolder}
              workspace={workspace}
              folder={folder}
            />
            <div className='folder-items table-item-container' style={{ maxHeight: (window.innerHeight - 200) + 'px' }}>
              {!folder && folders.map((folder, index) => {
                return (
                  <DndDTableFolder
                    key={index}
                    folder={folder}
                    isOwnerOrAdmin={isOwnerOrAdmin}
                    deleteFolder={this.props.deleteFolder}
                    onUpdateFolderName={this.props.onUpdateFolderName}
                    moveFolderItem={this.props.moveFolderItem}
                    moveTableToFolder={this.props.moveTableToFolder}
                    setDropdownState={this.props.setDropdownState}
                    getDropdownState={this.props.getDropdownState}
                    onFolderToggle={(e, folder) => {this.props.changeCurrentFolder(folder);}}
                  />
                );
              })}
              {projectList.map((project, index) => {
                return (
                  <DndDTableItemCommon
                    key={index}
                    project={project}
                    isItemFreezed={isItemFreezed}
                    renameTable={this.props.renameTable}
                    onShareTableToggle={this.props.onShareTableToggle}
                    onSetPasswordToggle={this.props.onSetPasswordToggle}
                    onUnsetPasswordToggle={this.props.onUnsetPasswordToggle}
                    onModifyPasswordToggle={this.props.onModifyPasswordToggle}
                    onDeleteTableToggle={this.props.onDeleteTableToggle}
                    onTableAPITokenToggle={this.props.onTableAPITokenToggle}
                    onWebhookToggle={this.props.onWebhookToggle}
                    onFreezedItem={this.onFreezedItem}
                    onUnfreezedItem={this.onUnfreezedItem}
                    onTableSnapshotsToggle={this.props.onTableSnapshotsToggle}
                    onCopyDTableToggle={this.props.onCopyDTableToggle}
                    isOwner={isOwner}
                    isAdmin={isAdmin}
                    onAddStarDTable={this.props.onAddStarDTable}
                    onUnstarDTable={this.props.onUnstarDTable}
                    onAddDTable={this.props.onAddDTable}
                    onUpdateTable={this.props.onUpdateTable}
                    onMoveFolderItemToggle={this.props.onMoveFolderItemToggle}
                    moveFolderItem={this.props.moveFolderItem}
                    folder={folder}
                    changeContainerColor={this.props.changeContainerColor}
                    setDropdownState={this.props.setDropdownState}
                    getDropdownState={this.props.getDropdownState}
                    eventBus={this.eventBus}
                  />
                );
              })}
              {shareProjectList.map((table, index) => {
                return (
                  <DndDTableItemGroupShared
                    key={index}
                    sharedItemKey={`table-${index}`}
                    table={table}
                    folder={folder}
                    isItemFreezed={isItemFreezed}
                    isAdmin={isAdmin}
                    onLeaveShare={this.props.onLeaveGroupSharedTable}
                    onAddStarDTable={this.props.onAddStarDTable}
                    onUnstarDTable={this.props.onUnstarDTable}
                    setDropdownState={this.props.setDropdownState}
                    getDropdownState={this.props.getDropdownState}
                    onMoveFolderItemToggle={this.props.onMoveFolderItemToggle}
                    onCopyDTableToggle={this.props.onCopyDTableToggle}
                    onCopyDTable={this.props.onCopyDTable}
                    currentWorkspace={workspace}
                  />
                );
              })}
              {isShowVirtualDtable &&
                <VirtualDtable
                  currentWorkspace={workspace}
                  createBlankTable={this.createBlankTable}
                  hideVirtualDtable={this.hideVirtualDtable}
                  currentFolder={folder}
                />
              }
            </div>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

FolderItems.propTypes = FolderItemsPropTypes;

export default FolderItems;
