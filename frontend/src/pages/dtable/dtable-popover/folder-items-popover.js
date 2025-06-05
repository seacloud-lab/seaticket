import React from 'react';
import PropTypes from 'prop-types';
import { DropTarget } from 'react-dnd';
import DTableItemCommon from '../dtable-item-common';
import { Utils } from '../../../utils/utils';
import VirtualDtable from '../virtual-dtable';
import AddBaseDropdownMenu from '../dtable-dropdown-menu/add-base-dropdown';
import MobileAddBase from '../mobile/mobile-add-base';
import DtablePopover from '../../../components/dtable-popover';
import MobileCommonHeader from '../mobile/mobile-common-header';
import eventBus from '../../../utils/event-bus';

const dropTarget = {
  drop(props, monitor) {
  },
};

const dropCollect = (connect, monitor) => ({
  connectDropTarget: connect.dropTarget(),
  isOver: monitor.isOver(),
  canDrop: monitor.canDrop(),
});

const propTypes = {
  workspace: PropTypes.object,
  tableList: PropTypes.array,
  folder: PropTypes.object.isRequired,
  onFolderToggle: PropTypes.func.isRequired,
  createBlankTable: PropTypes.func.isRequired,
  onMoveFolderItemToggle: PropTypes.func,
  moveFolderItem: PropTypes.func,
  renameTable: PropTypes.func.isRequired,
  onShareTableToggle: PropTypes.func.isRequired,
  onSetPasswordToggle: PropTypes.func,
  onUnsetPasswordToggle: PropTypes.func,
  onModifyPasswordToggle: PropTypes.func,
  onDeleteTableToggle: PropTypes.func.isRequired,
  onTableAPITokenToggle: PropTypes.func.isRequired,
  onWebhookToggle: PropTypes.func.isRequired,
  onTableSnapshotsToggle: PropTypes.func.isRequired,
  onCopyDTableToggle: PropTypes.func.isRequired,
  isOwner: PropTypes.bool.isRequired,
  isAdmin: PropTypes.bool.isRequired,
  onAddStarDTable: PropTypes.func.isRequired,
  onUnstarDTable: PropTypes.func.isRequired,
  onAddDTable: PropTypes.func.isRequired,
  onUpdateTable: PropTypes.func.isRequired,
  onMobileShareTableToggle: PropTypes.func.isRequired,
  onMobileUpdateTableToggle: PropTypes.func.isRequired,
  canAddDTable: PropTypes.bool.isRequired,
  onShowTemplateListToggle: PropTypes.func.isRequired,
  uploadDTableFile: PropTypes.func.isRequired,
  createTableInFolder: PropTypes.func.isRequired,
  folderPopoverStyle: PropTypes.object,
  changeContainerColor: PropTypes.func,
  setDropdownState: PropTypes.func,
  getDropdownState: PropTypes.func,
};

class FolderItemsPopover extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      tableList: [],
      isItemFreezed: false,
      isShowVirtualDtable: false,
      styles: null,
    };
    this.animationEnd = false;
    this.isDesktop = Utils.isDesktop();
    this.eventBus = eventBus;
  }

  componentDidMount() {
    let callback = this.rebuildItems;
    this.startAnimation(callback);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.rebuildItems(nextProps);
  }

  rebuildItems = (props) => {
    let { folder } = props;
    let folderItems = folder.items;
    if (!folderItems) {
      return;
    }
    const folderMap = this.getFolderItemsMap(folderItems);
    let folderTables = [];
    this.props.tableList.forEach((table) => {
      if (folderMap.get(table.uuid)) {
        folderTables.push(table);
      }
    });
    this.setState({ tableList: folderTables });
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

  uploadDTableFile = (workspaceID, file) => {
    this.props.uploadDTableFile(workspaceID, file, this.props.folder.id);
  };

  onFolderToggle = () => {
    this.eventBus.dispatch('folder-close');
    this.props.onFolderToggle(null);
  };

  createTableInFolder = (tableName, owner, dtableIcon, dtableColor) => {
    this.props.createTableInFolder(tableName, owner, dtableIcon, dtableColor, this.props.folder);
  };

  renderAddTableItem = () => {
    const { folder, workspace } = this.props;
    let { isItemFreezed } = this.state;
    if (this.isDesktop) {
      return (
        <div className={`table-item ${isItemFreezed ? '' : 'add-table-range'}`}>
          <AddBaseDropdownMenu
            onShowTemplateListToggle={this.props.onShowTemplateListToggle}
            uploadDTableFile={this.uploadDTableFile}
            currentWorkspace={workspace}
            onCreateTableToggle={this.showVirtualDtable}
            folder={folder}
          />
        </div>
      );
    }
    return (
      <MobileAddBase
        addDtableFromExternalLink={this.addDtableFromExternalLink}
        currentWorkspace={workspace}
        uploadDTableFile={this.uploadDTableFile}
        createDTable={this.createTableInFolder}
        ref={ref => this.addBaseRef = ref}
        folder={folder}
        isCreatedTemplateLoading={this.state.isCreatedTemplateLoading}
      />
    );
  };

  onInnerClick = (e) => {
    // click inner popover(edit base popover)
    let fatherDom = e.target.parentNode;
    while (fatherDom) {
      if (fatherDom.className && (fatherDom.className.includes('popover') || fatherDom.className.includes('modal'))) {
        return false;
      }
      fatherDom = fatherDom.parentNode;
    }
    return true;
  };

  getFolderIndex = () => {
    const { workspace, folder } = this.props;
    const currentFolderId = folder.id;
    const folderIndex = workspace.folders.findIndex(item => item.id === currentFolderId);
    return folderIndex;
  };

  startAnimation = (callback) => {
    // Mobile no animation
    if (!this.isDesktop) {
      this.animationEnd = true;
      callback(this.props);
      return;
    }
    // PC show animation, use setTimeout to make sure animation fire after real dom rendered
    setTimeout(() => {
      const { x, y } = this.props.folderPopoverStyle;
      let folderIndex = this.getFolderIndex();
      const popoverWidth = 400;
      const popoverHeight = 350;
      // If the folder is on the right and the index is odd
      const isOdd = folderIndex % 2 === 1;
      // The popover will move to the left, vice versa.
      const interval = 50;
      let left = isOdd ? (x - popoverWidth - interval) : (x + interval);
      let styles = {
        width: popoverWidth,
        height: popoverHeight,
        position: 'absolute',
        top: Math.min(y, window.innerHeight - popoverHeight - interval),
        left: `${left}px`,
        transform: 'none',
        willChange: 'transform',
        // there ane models(1050) in popover, so popover(1040) is lower than models
        zIndex: 1040,
        transition: 'all .3s',
      };
      this.setState({ styles });
      // After 0.3s animation, run callback
      setTimeout(() => {
        this.animationEnd = true;
        callback(this.props);
      }, 300);
    }, 1);
  };

  getPopoverInitStyle = (data) => {
    const { x, y } = this.props.folderPopoverStyle;
    let styles = {
      position: 'absolute',
      width: 30,
      minWidth: 30,
      height: 30,
      top: y,
      left: x,
      transform: 'none',
      willChange: 'transform',
      // there ane models(1050) in popover, so popover(1040) is lower than models
      zIndex: 1040,
    };
    data.styles = styles;
    return data;
  };

  render() {
    const { folder, isOwner, isAdmin, workspace, canAddDTable } = this.props;
    let { tableList, isItemFreezed, isShowVirtualDtable, styles } = this.state;
    let commonDom = (
      <>
        {isShowVirtualDtable && (
          <VirtualDtable
            currentWorkspace={workspace}
            createBlankTable={this.createBlankTable}
            hideVirtualDtable={this.hideVirtualDtable}
            currentFolder={folder}
          />
        )}
        {canAddDTable && (isOwner || isAdmin) && this.animationEnd && this.renderAddTableItem()}
      </>
    );

    // mobile single page
    if (!this.isDesktop) {
      return (
        <div className="add-blank-table dtable-folder-view">
          <MobileCommonHeader
            title={folder.name}
            leftName={<i className="dtable-font dtable-icon-return"></i>}
            onLeftClick={this.onFolderToggle}
          />
          <div className='folder'>
            <div className='folder-items table-mobile-item-container'>
              {tableList.map((table) => {
                return (
                  <DTableItemCommon
                    table={table}
                    isItemFreezed={isItemFreezed}
                    renameTable={this.props.renameTable}
                    onShareTableToggle={this.props.onShareTableToggle}
                    onSetPasswordToggle={this.props.onSetPasswordToggle}
                    onUnsetPasswordToggle={this.props.onUnsetPasswordToggle}
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
                    onMobileShareTableToggle={this.props.onMobileShareTableToggle}
                    onMobileUpdateTableToggle={this.props.onMobileUpdateTableToggle}
                    onMoveFolderItemToggle={this.props.onMoveFolderItemToggle}
                    moveFolderItem={this.props.moveFolderItem}
                    folder={folder}
                  />
                );
              })}
              {commonDom}
            </div>
          </div>
        </div>
      );
    }

    let options = null;
    if (!styles) {
      options = { fn: this.getPopoverInitStyle };
    } else {
      options = {
        fn: (data) => {
          data.styles = Object.assign({}, styles);
          return data;
        }
      };
    }
    const modifiers = [{ name: 'offset', options: options }];
    // PC popover
    let DndDTableItemCommon = DropTarget('Base', dropTarget, dropCollect)(DTableItemCommon);
    return (
      <DtablePopover
        hideArrow={true}
        placement='right'
        popoverClassName="folder-items-popover"
        target={`dtable-folder-${folder.id}`}
        hideDTablePopover={this.onFolderToggle}
        hideDTablePopoverWithEsc={this.onFolderToggle}
        onInnerClick={this.onInnerClick}
        modifiers={modifiers}
      >
        <div className='folder'>
          <div className='folder-items table-item-container'>
            {tableList.map((table, index) => {
              return (
                <DndDTableItemCommon
                  key={index}
                  table={table}
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
                  onMobileShareTableToggle={this.props.onMobileShareTableToggle}
                  onMobileUpdateTableToggle={this.props.onMobileUpdateTableToggle}
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
            {commonDom}
          </div>
        </div>
      </DtablePopover>
    );
  }
}

FolderItemsPopover.propTypes = propTypes;

export default FolderItemsPopover;
