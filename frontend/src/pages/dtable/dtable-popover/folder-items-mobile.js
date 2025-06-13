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
    this.initValue(nextProps);
  }

  initValue = (props) => {
    let { folder, projectList, groupSharedTables } = props;
    let folderItems = folder.items;
    if (!folderItems) {
      return;
    }
    const folderMap = this.getFolderItemsMap(folderItems);
    let folderProjects = [];
    let folderShareProjects = [];
    projectList.forEach((project) => {
      if (folderMap.get(project.uuid)) {
        folderProjects.push(project);
      }
    });
    groupSharedTables.forEach((shareProject) => {
      if (folderMap.get(shareProject.dtable_share_id.toString())) {
        folderShareProjects.push(shareProject);
      }
    });
    this.setState({
      projectList: folderProjects,
      shareProjectList: folderShareProjects,
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

  getFolderIndex = () => {
    const { workspace, folder } = this.props;
    return workspace.folders.findIndex(item => item.id === folder.id);
  };

  render() {
    const { folder, isOwner, isAdmin, workspace, canAddProject } = this.props;
    let { projectList, shareProjectList, isItemFreezed, isShowVirtualDtable } = this.state;
    return (
      <div className="add-blank-table dtable-folder-view">
        <MobileCommonHeader
          title={folder.name}
          leftName={<i className="dtable-font dtable-icon-return"></i>}
          onLeftClick={this.onFolderToggle}
        />
        <div className='folder'>
          <div className='folder-items table-mobile-item-container'>
            {projectList.map((project, index) => {
              return (
                <DTableItemCommon
                  project={project}
                  key={index}
                  isItemFreezed={isItemFreezed}
                  renameTable={this.props.renameTable}
                  onShareTableToggle={this.props.onShareTableToggle}
                  onSetPasswordToggle={this.props.onSetPasswordToggle}
                  onUnsetPasswordToggle={this.props.onUnsetPasswordToggle}
                  onDeleteTableToggle={this.props.onDeleteTableToggle}
                  onTableAPITokenToggle={this.props.onTableAPITokenToggle}
                  onFreezedItem={this.onFreezedItem}
                  onUnfreezedItem={this.onUnfreezedItem}
                  onTableSnapshotsToggle={this.props.onTableSnapshotsToggle}
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
            {shareProjectList.map((project, index) => {
              return (
                <DTableItemGroupShared
                  key={`share-table-${index}`}
                  sharedItemKey={`table-${index}`}
                  project={project}
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
            {canAddProject && (isOwner || isAdmin) &&
              <MobileAddBase
                currentWorkspace={workspace}
                createProject={this.createProjectInFolder}
                ref={ref => this.addBaseRef = ref}
                folder={folder}
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
