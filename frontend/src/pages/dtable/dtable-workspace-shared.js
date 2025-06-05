import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { DropTarget } from 'react-dnd';
import { toaster } from 'dtable-ui-component';
import html5DragDropContext from '../../utils/html5DragDropContext';
import DTableItemShared from './dtable-item-shared';
import DTableItemViewShared from './dtable-item-view-shared';
import { dtableWebAPI } from '../../api/dtable-web-api';
import { isEnter } from '../../utils/hotkey';
import { Utils } from '../../utils/utils';
import { compareTwoString } from './utils/compare-two-string';
import ObjectUtils from '../../utils/object-utils';
import ModalPortal from '../../components/modal-portal';
import CopyDTableDialog from './dialog/copy-dtable-dialog';
import MoveShareTableViewDialog from './dialog/move-share-table-view-dialog';
import ShareFolderItemsMobile from './dtable-popover/share-folder-items-mobile';
import VirtualFolder from './virtual-folder';
import DTableFolder from './dtable-folder';
import AddBlankShareFolder from './mobile/add-blank-share-folder';
import ShareFolderItemsDialog from './dtable-popover/share-folder-items-dialog';

const gettext = window.gettext;
const username = window.app.pageOptions.username;

const dropTarget = {
  drop(props, monitor) {
  },
  canDrop(props, monitor) {
    return false;
  },
};

// TODO Folder can be dropped(move root table into folder)
const folderDropTarget = {
  drop(props, monitor) {
    const optionSource = monitor.getItem();
    const dropFolder = props.folder;
    props.moveTableToFolder(optionSource, dropFolder);
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

const DndDTableFolder = DropTarget('Base', folderDropTarget, dropCollect)(DTableFolder);
const DndDTableItemShared = DropTarget('Base', dropTarget, dropCollect)(DTableItemShared);
const DndDTableItemViewShared = DropTarget('Base', dropTarget, dropCollect)(DTableItemViewShared);

class DTableWorkspaceShared extends React.Component {

  static propTypes = {
    sharedWorkspace: PropTypes.object.isRequired,
    noBaseTip: PropTypes.object,
    loadWorkspaceList: PropTypes.func.isRequired,
    onCopyDTable: PropTypes.func.isRequired
  };

  constructor(props) {
    super(props);
    this.state = {
      share_folders: [],
      tableList: [],
      viewList: [],
      isItemFreezed: false,
      isShowCopyDTable: false,
      isShowVirtualFolder: false,
      isShowFolderOpen: false,
      isShowMoveDialog: false,
      currentFolder: null,
      toBeMovedItem: null,
    };
    this.isDesktop = Utils.isDesktop();
    this.isDropdownOpen = false;
  }

  componentDidMount() {
    const { sharedWorkspace } = this.props;
    const { share_folders, tableList, viewList } = this.getSortedWorkspaceSharedContent(sharedWorkspace);
    this.setState({ share_folders, tableList, viewList });
    document.addEventListener('keydown', this.onHotKey);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onHotKey);
  }

  onHotKey = (e) => {
    if (isEnter(e) && document.activeElement && document.activeElement.id === 'dtable-workspace-shared-add-folder') {
      this.showVirtualFolder();
    }
  };

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (!ObjectUtils.isSameObject(nextProps.sharedWorkspace, this.props.sharedWorkspace)) {
      const { share_folders, tableList, viewList } = this.getSortedWorkspaceSharedContent(nextProps.sharedWorkspace);
      this.setState({ share_folders, tableList, viewList });
    }
  }

  getSortedWorkspaceSharedContent = (sharedWorkspace) => {
    const { shared_table_list, shared_view_list, share_folders } = sharedWorkspace;
    return {
      tableList: shared_table_list.sort((a, b) => compareTwoString(a.name, b.name)),
      viewList: shared_view_list.sort((a, b) => compareTwoString(a.shared_name, b.shared_name)),
      share_folders: share_folders.sort((a, b) => compareTwoString(a.name, b.name)),
    };
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

  leaveShareTable = (table) => {
    let email = username;
    let tableName = table.name;
    let workspaceID = table.workspace_id;
    const { tableList } = this.state;
    dtableWebAPI.deleteTableShare(workspaceID, tableName, email).then(() => {
      const newTableList = tableList.filter(table => {
        return table.name !== tableName;
      });
      this.setState({ tableList: newTableList });
    }).catch((error) => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (errMsg.indexOf('not shared to') > -1) {
        let newTableList = tableList.filter(table => {
          return table.name !== tableName;
        });
        this.setState({
          tableList: newTableList,
        });
        return;
      }
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
        this.setState({ errorMsg: errMsg });
      }
    });
  };

  leaveSharedView = (viewShare) => {
    dtableWebAPI.leaveViewShare(viewShare.id).then(() => {
      let viewList = this.state.viewList.filter(view => {
        return view.id !== viewShare.id;
      });
      this.setState({ viewList: viewList });
    }).catch((error) => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
        this.setState({ errorMsg: errMsg });
      }
    });
  };

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  onCopyDTableToggle = (table) => {
    this.setState({
      isShowCopyDTable: !this.state.isShowCopyDTable,
      currentTable: table
    });
    this.onUnfreezedItem();
  };

  onShowTemplateListToggle = () => {
    this.setState({ isShowTemplateList: !this.state.isShowTemplateList });
  };

  showVirtualFolder = () => {
    this.setState({ isShowVirtualFolder: true });
  };

  hideVirtualFolder = () => {
    this.setState({ isShowVirtualFolder: false });
  };

  createBlankFolder = (folder) => {
    let share_folders = this.state.share_folders.slice(0);
    share_folders.push(folder);
    this.setState({
      isShowVirtualFolder: false,
      share_folders,
    });
  };

  onUpdateFolderName = (folderID, folderName) => {
    dtableWebAPI.renameShareFolder(folderName, folderID).then((res) => {
      let folder = res.data.folder;
      let share_folders = this.state.share_folders.slice(0);
      let folderIndex = share_folders.findIndex(folder => folder.id === folderID);
      share_folders.splice(folderIndex, 1, Object.assign({}, share_folders[folderIndex], folder));
      this.setState({ share_folders });
      let { currentFolder } = this.state;
      if (currentFolder && currentFolder.id === folderID) {
        currentFolder = Object.assign({}, currentFolder, { name: folder.name });
        this.setState({ currentFolder });
      }
    }).catch((error) => {
      this.handleError(error);
    });
  };

  deleteFolder = (folderID) => {
    dtableWebAPI.deleteShareFolder(folderID).then((res) => {
      if (res.data.success) {
        let share_folders = this.state.share_folders.filter(folder => folder.id !== folderID);
        if (this.state.currentFolder && folderID === this.state.currentFolder.id) {
          this.setState({
            currentFolder: null,
            share_folders,
          });
        } else {
          this.setState({ share_folders });
        }
      }
    }).catch(error => {
      this.handleError(error);
    });
  };

  renderAddFolder = () => {
    const preCls = this.isDesktop ? 'table-' : 'table-mobile-';
    return (
      <div
        id="dtable-workspace-shared-add-folder"
        className={`${preCls}item ${this.state.isItemFreezed ? '' : 'add-table-range'}`}
        onClick={this.showVirtualFolder}
        tabIndex={0}
        role="button"
        title={gettext('Add a folder')}
        aria-label={gettext('Add a folder')}
      >
        <div className={`${preCls}icon`} aria-hidden="true">
          <span className="table-icon-content">
            <i className="base-font icon-add dtable-icon-style"></i>
          </span>
        </div>
        <div className={`${preCls}name`}>
          <span className="a-simulate" title={gettext('Add a folder')} aria-label={gettext('Add a folder')}>{gettext('Add a folder')}</span>
        </div>
        <div className={`${preCls}dropdown-menu`}></div>
      </div>
    );
  };

  renderVirtualFolder = () => {
    if (this.isDesktop) {
      return (
        <VirtualFolder
          createBlankFolder={this.createBlankFolder}
          hideVirtualFolder={this.hideVirtualFolder}
        />
      );
    } else {
      return (
        <ModalPortal>
          <AddBlankShareFolder
            createBlankFolder={this.createBlankFolder}
            onCreateFolderToggle={this.hideVirtualFolder}
          />
        </ModalPortal>
      );
    }
  };

  onFolderToggle = (event, folder) => {
    if (this.state.isShowFolderOpen) {
      this.setDropdownState(false);
    }
    this.setState({
      isShowFolderOpen: !this.state.isShowFolderOpen,
      currentFolder: folder
    });
  };

  getDropdownState = () => {
    return this.isDropdownOpen;
  };

  setDropdownState = (state) => {
    this.isDropdownOpen = state;
  };

  changeCurrentFolder = (folder, callback) => {
    this.setState({ currentFolder: folder }, () => {
      if (typeof callback === 'function') {
        callback();
      }
    });
  };

  onMoveFolderItemToggle = (toBeMovedItem) => {
    this.setState({
      toBeMovedItem,
      isShowMoveDialog: !this.state.isShowMoveDialog
    });
  };

  // drag share base or view to folder
  moveTableToFolder = (dragSource, dropFolder) => {
    if (!dragSource || !dropFolder) return;
    const { data, mode } = dragSource;
    const toBeMovedItem = {
      item: data,
      item_type: mode,
    };
    this.moveFolderItem(toBeMovedItem, dropFolder ? dropFolder.name : '/');
  };

  // To: target folder name. If to is "/", move it to the share to me root directory
  moveFolderItem = (toBeMovedItem, to) => {
    if (!toBeMovedItem) {
      return;
    }
    const { item_type, item } = toBeMovedItem;
    if (item_type === 'dtable') {
      dtableWebAPI.moveShareTableToFolder(item.share_id, to).then(res => {
        if (res.data.success) {
          this.props.loadWorkspaceList();
        }
      }).catch(error => {
        this.handleError(error);
      });
    } else if (item_type === 'view') {
      dtableWebAPI.moveShareViewToFolder(item.share_id, to).then(res => {
        if (res.data.success) {
          this.props.loadWorkspaceList();
        }
      }).catch(error => {
        this.handleError(error);
      });
    }
  };
  renderEmptyTip = () => {
    let { share_folders, tableList, viewList } = this.state;
    if (!share_folders || !tableList || !viewList) {
      return this.props.noBaseTip || '';
    }
    if (share_folders.length === 0 && tableList.length === 0 && viewList.length === 0) {
      return this.props.noBaseTip || '';
    }
  };

  render() {
    let { share_folders, tableList, viewList, isItemFreezed, isShowFolderOpen, currentFolder } = this.state;

    return (
      <Fragment>
        <div className="workspace">
          <div className={`${this.isDesktop ? '' : 'table-mobile-heading '}table-heading`}>
            <span className="table-workspace-icon dtable-font dtable-icon-share-with-me" aria-hidden="true"></span>
            <span>{gettext('Shared with me')}</span>
          </div>
          <div className={`${this.isDesktop ? 'table-item-container' : 'table-mobile-item-container'}`}>
            {share_folders.map((folder, index) => {
              return (
                <DndDTableFolder
                  key={index}
                  folder={folder}
                  isOwnerOrAdmin={true}
                  onUpdateFolderName={this.onUpdateFolderName}
                  deleteFolder={this.deleteFolder}
                  onFolderToggle={this.onFolderToggle}
                  setDropdownState={this.setDropdownState}
                  getDropdownState={this.getDropdownState}
                  moveFolderItem={this.moveFolderItem}
                  moveTableToFolder={this.moveTableToFolder}
                />
              );
            })}
            {tableList.map((table, index) => {
              return (
                <DndDTableItemShared
                  key={index}
                  sharedItemIndex={index}
                  table={table}
                  leaveShareTable={this.leaveShareTable}
                  isItemFreezed={isItemFreezed}
                  onFreezedItem={this.onFreezedItem}
                  onUnfreezedItem={this.onUnfreezedItem}
                  onCopyDTableToggle={this.onCopyDTableToggle}
                  onMoveFolderItemToggle={this.onMoveFolderItemToggle}
                />
              );
            })}
            {viewList.map((view, index) => {
              return (
                <DndDTableItemViewShared
                  key={index}
                  view={view}
                  leaveSharedView={this.leaveSharedView}
                  sharedViewItemIndex={index}
                  isItemFreezed={isItemFreezed}
                  onFreezedItem={this.onFreezedItem}
                  onUnfreezedItem={this.onUnfreezedItem}
                  onMoveFolderItemToggle={this.onMoveFolderItemToggle}
                />
              );
            })}
            {this.state.isShowVirtualFolder && this.renderVirtualFolder()}
            {this.renderAddFolder()}
          </div>
          {this.state.isShowCopyDTable && (
            <CopyDTableDialog
              dtable={this.state.currentTable}
              onCopyDTableToggle={this.onCopyDTableToggle}
              onCopyDTable={this.props.onCopyDTable}
            />
          )}
          {this.isDesktop && isShowFolderOpen &&
          <ShareFolderItemsDialog
            share_folders={share_folders}
            tableList={tableList}
            viewList={viewList}
            folder={currentFolder}
            onFolderToggle={this.onFolderToggle}
            changeCurrentFolder={this.changeCurrentFolder}
            createBlankFolder={this.createBlankFolder}
            onShowTemplateListToggle={this.onShowTemplateListToggle}
            onFreezedItem={this.onFreezedItem}
            onUnfreezedItem={this.onUnfreezedItem}
            onCopyDTableToggle={this.onCopyDTableToggle}
            setDropdownState={this.setDropdownState}
            getDropdownState={this.getDropdownState}
            deleteFolder={this.deleteFolder}
            onUpdateFolderName={this.onUpdateFolderName}
            onMoveFolderItemToggle={this.onMoveFolderItemToggle}
            moveFolderItem={this.moveFolderItem}
            moveTableToFolder={this.moveTableToFolder}
            leaveSharedView={this.leaveSharedView}
            leaveShareTable={this.leaveShareTable}
          />
          }
          {!this.isDesktop && isShowFolderOpen &&
          <ShareFolderItemsMobile
            share_folders={share_folders}
            tableList={tableList}
            viewList={viewList}
            folder={currentFolder}
            onFolderToggle={this.onFolderToggle}
            onShowTemplateListToggle={this.onShowTemplateListToggle}
            onCopyDTableToggle={this.onCopyDTableToggle}
            deleteFolder={this.deleteFolder}
            onUpdateFolderName={this.onUpdateFolderName}
            onMoveFolderItemToggle={this.onMoveFolderItemToggle}
            leaveSharedView={this.leaveSharedView}
            leaveShareTable={this.leaveShareTable}
          />
          }
          {this.state.isShowMoveDialog &&
          <MoveShareTableViewDialog
            currentFolder={currentFolder}
            folders={share_folders}
            toBeMovedItem={this.state.toBeMovedItem}
            moveFolderItem={this.moveFolderItem}
            onMoveFolderItemToggle={this.onMoveFolderItemToggle}
          />
          }
        </div>
        {this.renderEmptyTip()}
      </Fragment>
    );
  }
}

const DndOptionsContainer = DropTarget('Base', {}, connect => ({
  connectDropTarget: connect.dropTarget()
}))(DTableWorkspaceShared);

export default html5DragDropContext(DndOptionsContainer);
