import React from 'react';
import DTableItemCommon from '../dtable-item-common';
import DTableItemGroupShared from '../dtable-item-group-shared';
import VirtualDtable from '../virtual-dtable';
import MobileAddBase from '../mobile/mobile-add-base';
import MobileCommonHeader from '../mobile/mobile-common-header';
import eventBus from '../../../utils/event-bus';
import { FolderItemsPropTypes } from './folder-items-constants';

class FolderItems extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      tableList: [],
      shareTableList: [],
      shareViewList: [],
      isItemFreezed: false,
      isShowVirtualDtable: false,
    };
    this.eventBus = eventBus;
  }

  componentDidMount() {
    this.initValue(this.props);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.initValue(nextProps);
  }

  initValue = (props) => {
    let { folder, tableList, groupSharedTables, groupSharedViews } = props;
    let folderItems = folder.items;
    if (!folderItems) {
      return;
    }
    const folderMap = this.getFolderItemsMap(folderItems);
    let folderTables = [];
    let folderShareTables = [];
    let folderShareViews = [];
    tableList.forEach((table) => {
      if (folderMap.get(table.uuid)) {
        folderTables.push(table);
      }
    });
    groupSharedTables.forEach((shareTable) => {
      if (folderMap.get(shareTable.dtable_share_id.toString())) {
        folderShareTables.push(shareTable);
      }
    });
    groupSharedViews.forEach((shareView) => {
      if (folderMap.get(shareView.view_share_id.toString())) {
        folderShareViews.push(shareView);
      }
    });
    this.setState({
      tableList: folderTables,
      shareTableList: folderShareTables,
      shareViewList: folderShareViews,
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

  getFolderIndex = () => {
    const { workspace, folder } = this.props;
    return workspace.folders.findIndex(item => item.id === folder.id);
  };

  render() {
    const { folder, isOwner, isAdmin, workspace, canAddDTable } = this.props;
    let { tableList, shareTableList, shareViewList, isItemFreezed, isShowVirtualDtable } = this.state;
    return (
      <div className="add-blank-table dtable-folder-view">
        <MobileCommonHeader
          title={folder.name}
          leftName={<i className="dtable-font dtable-icon-return"></i>}
          onLeftClick={this.onFolderToggle}
        />
        <div className='folder'>
          <div className='folder-items table-mobile-item-container'>
            {tableList.map((table, index) => {
              return (
                <DTableItemCommon
                  table={table}
                  key={index}
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
            {isShowVirtualDtable && (
              <VirtualDtable
                currentWorkspace={workspace}
                createBlankTable={this.createBlankTable}
                hideVirtualDtable={this.hideVirtualDtable}
                currentFolder={folder}
              />
            )}
            {shareTableList.map((table, index) => {
              return (
                <DTableItemGroupShared
                  key={`share-table-${index}`}
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
                />
              );
            })}
            {shareViewList.map((view, index) => {
              return (
                <DTableItemGroupShared
                  key={`share-view-${index}`}
                  sharedItemKey={`view-${index}`}
                  table={view}
                  folder={folder}
                  isItemFreezed={isItemFreezed}
                  isAdmin={isAdmin}
                  onLeaveShare={this.props.onLeaveGroupSharedView}
                  onAddStarDTable={this.props.onAddStarDTable}
                  onUnstarDTable={this.props.onUnstarDTable}
                  setDropdownState={this.props.setDropdownState}
                  getDropdownState={this.props.getDropdownState}
                  onMoveFolderItemToggle={this.props.onMoveFolderItemToggle}
                />
              );
            })}
            {canAddDTable && (isOwner || isAdmin) &&
              <MobileAddBase
                addDtableFromExternalLink={this.addDtableFromExternalLink}
                currentWorkspace={workspace}
                uploadDTableFile={this.uploadDTableFile}
                createDTable={this.createTableInFolder}
                ref={ref => this.addBaseRef = ref}
                folder={folder}
                isCreatedTemplateLoading={this.state.isCreatedTemplateLoading}
              />
            }
          </div>
        </div>
      </div>
    );
  }
}

FolderItems.propTypes = FolderItemsPropTypes;

export default FolderItems;
