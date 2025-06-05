import React from 'react';
import { DropTarget } from 'react-dnd';
import { Modal, ModalBody } from 'reactstrap';
import { DTableModalHeader } from 'dtable-ui-component';
import Loading from '../../../components/loading';
import DTableFolder from '../dtable-folder';
import { folderImageSrc } from '../../../constants/image-source-constants';
import eventBus from '../../../utils/event-bus';
import FolderItemsDialogFilePath from './folder-items-dialog-widgets/folder-items-dialog-file-path';
import FolderTree from './folder-items-dialog-widgets/folder-tree';
import DTableItemShared from '../dtable-item-shared';
import DTableItemViewShared from '../dtable-item-view-shared';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { FolderItemsPropTypes } from './folder-items-constants';

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
    const dropFolder = props.folder;
    props.moveTableToFolder(optionSource, dropFolder);
  },
  canDrop(props, monitor) {
    const optionSource = monitor.getItem();
    return !optionSource.folder;
  },
};

const DndDTableFolder = DropTarget('Base', folderDropTarget, dropCollect)(DTableFolder);
const DndDTableItemShared = DropTarget('Base', dropTarget, dropCollect)(DTableItemShared);
const DndDTableItemViewShared = DropTarget('Base', dropTarget, dropCollect)(DTableItemViewShared);

class ShareFolderItems extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      tableList: [],
      viewList: [],
      isItemFreezed: false,
      isLoading: true,
    };
    this.eventBus = eventBus;
  }

  componentDidMount() {
    this.getFolderContent(this.props);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    setTimeout(() => {
      this.getFolderContent(nextProps);
    }, 1);
  }

  getFolderContent = (props) => {
    let { folder } = props;
    // In the root, use the parent component tableList and viewList
    if (!folder) {
      const { tableList, viewList } = props;
      this.setState({
        tableList,
        viewList,
        isLoading: false,
      });
    }
    // In a folder, get share folder content from server
    if (folder) {
      this.setState({ isLoading: true });
      dtableWebAPI.getShareFolderContent(folder.id).then((res) => {
        const { shared_table_list, shared_view_list } = res.data;
        this.setState({
          tableList: shared_table_list,
          viewList: shared_view_list,
          isLoading: false,
        });
      });
    }
  };

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  onFolderToggle = () => {
    this.eventBus.dispatch('folder-close');
    this.props.onFolderToggle(null);
  };

  render() {
    const { folder, share_folders } = this.props;
    let { viewList, tableList, isItemFreezed, isLoading } = this.state;

    return (
      <Modal isOpen={true} toggle={this.onFolderToggle} className="folder-items-dialog">
        <DTableModalHeader toggle={this.onFolderToggle}>
          <div className="modal-title-left">
            <img src={folderImageSrc} height="24px" alt="" />
            <span className="ml-2">{folder ? folder.name : window.gettext('Shared with me')}</span>
          </div>
          <div className="modal-title-right"></div>
        </DTableModalHeader>
        <ModalBody>
          <FolderTree
            changeCurrentFolder={this.props.changeCurrentFolder}
            folder={folder}
            folders={share_folders}
            isOwnerOrAdmin={true}
            createBlankFolder={this.props.createBlankFolder}
            deleteFolder={this.props.deleteFolder}
            onUpdateFolderName={this.props.onUpdateFolderName}
            moveTableToFolder={this.props.moveTableToFolder}
          />
          <div className='folder'>
            <FolderItemsDialogFilePath
              changeCurrentFolder={this.props.changeCurrentFolder}
              folder={folder}
            />
            <div className='folder-items table-item-container' style={{ maxHeight: (window.innerHeight - 200) + 'px' }}>
              {isLoading && <Loading />}
              {!folder && !isLoading && share_folders.map((folder, index) => {
                return (
                  <DndDTableFolder
                    key={index}
                    folder={folder}
                    isOwnerOrAdmin={true}
                    deleteFolder={this.props.deleteFolder}
                    onUpdateFolderName={this.props.onUpdateFolderName}
                    setDropdownState={this.props.setDropdownState}
                    getDropdownState={this.props.getDropdownState}
                    onFolderToggle={(e, folder) => {
                      this.props.changeCurrentFolder(folder);
                      this.setState({
                        tableList: [],
                        viewList: [],
                      });
                    }}
                    moveFolderItem={this.props.moveFolderItem}
                    moveTableToFolder={this.props.moveTableToFolder}
                  />
                );
              })}
              {!isLoading && tableList.map((table, index) => {
                return (
                  <DndDTableItemShared
                    key={index}
                    sharedItemIndex={index}
                    table={table}
                    leaveShareTable={this.props.leaveShareTable}
                    isItemFreezed={isItemFreezed}
                    onFreezedItem={this.onFreezedItem}
                    onUnfreezedItem={this.onUnfreezedItem}
                    onCopyDTableToggle={this.props.onCopyDTableToggle}
                    onMoveFolderItemToggle={this.props.onMoveFolderItemToggle}
                  />
                );
              })}
              {!isLoading && viewList.map((view, index) => {
                return (
                  <DndDTableItemViewShared
                    key={index}
                    view={view}
                    leaveSharedView={this.props.leaveSharedView}
                    sharedViewItemIndex={index}
                    isItemFreezed={isItemFreezed}
                    onFreezedItem={this.onFreezedItem}
                    onUnfreezedItem={this.onUnfreezedItem}
                    onMoveFolderItemToggle={this.props.onMoveFolderItemToggle}
                  />
                );
              })}
            </div>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

ShareFolderItems.propTypes = FolderItemsPropTypes;

export default ShareFolderItems;
